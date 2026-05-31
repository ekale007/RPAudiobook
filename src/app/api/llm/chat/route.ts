import { NextResponse } from "next/server";
import {
  getOpenRouterApiKey,
  getOpenRouterModel,
  getOpenRouterNarratorModel,
  getRateLimitLlmPerHour,
} from "@/lib/server/env";
import {
  extractOpenRouterErrorMessage,
  formatOpenRouterErrorMessage,
  isOpenRouterPrivacyError,
} from "@/lib/llm/openRouterErrors";
import { fetchMonthlyUsage } from "@/lib/server/llmUsage";
import {
  createUsageTrackingStream,
  recordUsageFromJsonResponse,
} from "@/lib/server/llmUsageStream";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function openRouterHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    "X-Title": "HörbuchKI",
  };
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);

  let monthly;
  try {
    monthly = await fetchMonthlyUsage(supabase, auth.user.id);
  } catch {
    monthly = null;
  }

  if (monthly && monthly.costCents >= monthly.budgetCents) {
    return NextResponse.json(
      {
        error: "Monatliches LLM-Budget erreicht",
        code: "budget_exceeded",
        monthly,
        retryAfterSec: null,
      },
      { status: 429 },
    );
  }

  const limit = checkRateLimit(
    `llm:${auth.user.id}`,
    getRateLimitLlmPerHour(),
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "LLM rate limit exceeded",
        code: "hourly_limit",
        retryAfterSec: limit.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY not configured on server" },
      { status: 503 },
    );
  }

  let body: {
    messages?: Array<{ role: string; content: string }>;
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
    model?: string;
    useNarratorModel?: boolean;
    responseFormat?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body.messages;
  if (!messages?.length) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const model =
    body.model?.trim() ||
    (body.useNarratorModel ? getOpenRouterNarratorModel() : undefined) ||
    getOpenRouterModel();

  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: body.maxTokens ?? 2048,
    temperature: body.temperature ?? 0.85,
    stream: Boolean(body.stream),
  };
  if (body.responseFormat) {
    payload.response_format = body.responseFormat;
  }

  const upstream = await postOpenRouter(apiKey, payload);

  if (!upstream.ok) {
    const errText = await upstream.text();
    const message = extractOpenRouterErrorMessage(errText);
    const formatted = formatOpenRouterErrorMessage(message, upstream.status);

    const fallbackModel = getOpenRouterModel();
    if (
      upstream.status === 404 &&
      isOpenRouterPrivacyError(message) &&
      fallbackModel &&
      fallbackModel !== model
    ) {
      const retry = await postOpenRouter(apiKey, {
        ...payload,
        model: fallbackModel,
      });
      if (retry.ok) {
        return forwardOpenRouterResponse(retry, body.stream, supabase);
      }
    }

    return NextResponse.json(
      { error: formatted, code: "openrouter_upstream" },
      { status: upstream.status },
    );
  }

  return forwardOpenRouterResponse(upstream, body.stream, supabase);
}

async function postOpenRouter(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(payload),
  });
}

async function forwardOpenRouterResponse(
  upstream: Response,
  stream: boolean | undefined,
  supabase: Awaited<ReturnType<typeof createServerSupabaseFromRequest>>,
): Promise<Response> {
  if (stream && upstream.body) {
    const tracked = createUsageTrackingStream(upstream.body, supabase);
    return new Response(tracked, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const json = await upstream.json();
  try {
    await recordUsageFromJsonResponse(supabase, json);
  } catch (e) {
    console.warn("LLM usage record failed:", e);
  }
  return NextResponse.json(json);
}
