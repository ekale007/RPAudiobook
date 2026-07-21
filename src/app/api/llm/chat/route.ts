import { NextResponse } from "next/server";
import { resolveAllowedLlmModelForTier } from "@/lib/server/userTier";
import { fetchUserTierLimits } from "@/lib/server/userTier";
import {
  getOpenRouterApiKey,
  getRateLimitLlmPerHour,
  getRateLimitTtsPerHour,
} from "@/lib/server/env";
import { getBetaLlmBudgetCents, requireLlmMonthlyBudget } from "@/lib/server/llmUsage";
import { requireSpendableBalance } from "@/lib/server/wallet";
import {
  createUsageTrackingStream,
  recordUsageFromJsonResponse,
} from "@/lib/server/llmUsageStream";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getProviderConfig, postLlmCompletion } from "@/lib/server/llmProviders";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);

  let tierLimits;
  try {
    tierLimits = await fetchUserTierLimits(supabase, auth.user.id);
  } catch {
    tierLimits = null;
  }

  let body: {
    messages?: Array<{ role: string; content: string }>;
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
    model?: string;
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

  // Resolve model first to determine which provider API key we need.
  const resolved = tierLimits
    ? resolveAllowedLlmModelForTier(body.model, tierLimits)
    : resolveAllowedLlmModelForTier(body.model, {
        tier: "beta",
        tierLabel: "Beta",
        llmBudgetCents: getBetaLlmBudgetCents(),
        llmPerHour: getRateLimitLlmPerHour(),
        ttsPerHour: getRateLimitTtsPerHour(),
        ttsStorageMax: 100,
        allowedModelIds: null,
      });

  const providerConfig = getProviderConfig(resolved.provider ?? "openrouter");
  if (!providerConfig || !providerConfig.isConfigured()) {
    const prov = resolved.provider ?? "openrouter";
    return NextResponse.json(
      { error: `LLM-Provider "${prov}" nicht konfiguriert — API-Key fehlt.` },
      { status: 503 },
    );
  }

  const providerModelId = resolved.providerModelId ?? resolved.id;
  const provider = resolved.provider ?? "openrouter";

  // Pre-flight wallet gate: free models (0¢) only need 1¢ minimum.
  const modelRate = Math.max(resolved.promptCentsPer1k, resolved.completionCentsPer1k);
  const estimatedMinCents = modelRate === 0
    ? 1
    : Math.max(1, Math.ceil(((body.maxTokens ?? 2048) / 1000) * (modelRate / 2)));
  const balanceErr = await requireSpendableBalance(supabase, auth.user.id, estimatedMinCents);
  if (balanceErr) return balanceErr;

  const budgetErr = await requireLlmMonthlyBudget(supabase, auth.user.id, tierLimits);
  if (budgetErr) return budgetErr;

  const llmPerHour = tierLimits?.llmPerHour ?? getRateLimitLlmPerHour();
  const limit = checkRateLimit(`llm:${auth.user.id}`, llmPerHour);
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

  const payload: Record<string, unknown> = {
    model: providerModelId,
    messages,
    max_tokens: body.maxTokens ?? 2048,
    temperature: body.temperature ?? 0.85,
    stream: Boolean(body.stream),
  };
  if (body.responseFormat && provider === "openrouter") {
    // Only OpenRouter supports response_format natively;
    // other providers handle it via system prompt instructions.
    payload.response_format = body.responseFormat;
  }

  const upstream = await postLlmCompletion(provider, payload);

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error: `${provider} error ${upstream.status}: ${errText.slice(0, 400)}`,
        code: "llm_upstream",
      },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }

  if (body.stream && upstream.body) {
    const tracked = createUsageTrackingStream(
      upstream.body,
      supabase,
      resolved.id,
      undefined, // Only OpenRouter supports generation-ID lookup
    );
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
  let llmCostCents = 0;
  try {
    // Non-OpenRouter providers: use catalog estimate (no usage.cost field).
    llmCostCents = await recordUsageFromJsonResponse(supabase, json, resolved.id);
  } catch (e) {
    console.warn("LLM usage record failed:", e);
  }
  return NextResponse.json(json, {
    headers:
      llmCostCents > 0
        ? { "X-LLM-Cost-Cents": String(llmCostCents) }
        : undefined,
  });
}
