import { NextResponse } from "next/server";
import { TTS_COST_HEADER } from "@/lib/llm/openRouterCompletion";
import { estimateOpenRouterTtsCostCents } from "@/lib/server/billingSettings";
import {
  getOpenRouterApiKey,
  getOpenRouterTtsModel,
  isServerOpenRouterTtsConfigured,
} from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";
import { insertUsageEvent } from "@/lib/server/usageEvents";
import {
  normalizeOpenRouterTtsModel,
  normalizeOpenRouterTtsVoice,
  formatOpenRouterTtsError,
} from "@/lib/tts/openRouterTtsModels";

const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";

export async function GET() {
  return NextResponse.json({
    serverOpenRouterTts: isServerOpenRouterTtsConfigured(),
    defaultModel: getOpenRouterTtsModel(),
  });
}

/** OpenRouter speech — POST /api/v1/audio/speech (server key). */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const ttsPerHour = await getTtsHourlyLimitForUser(supabase, auth.user.id);
  const limit = checkRateLimit(`tts-openrouter:${auth.user.id}`, ttsPerHour);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OpenRouter TTS not configured. Set OPENROUTER_API_KEY on the server.",
      },
      { status: 503 },
    );
  }

  let body: {
    text?: string;
    model?: string;
    voice?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  const model = normalizeOpenRouterTtsModel(
    body.model?.trim() || getOpenRouterTtsModel(),
  );
  const voice = normalizeOpenRouterTtsVoice(model, body.voice);

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > 2400) {
    return NextResponse.json(
      { error: "Text too long for single chunk (max 2400)" },
      { status: 400 },
    );
  }

  const upstream = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://hoerbuchki.app",
      "X-Title": "HörbuchKI",
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: "mp3",
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    const message = formatOpenRouterTtsError(upstream.status, errText, model);
    return NextResponse.json(
      { error: message, model, voice },
      {
        status:
          upstream.status >= 400 && upstream.status < 600
            ? upstream.status
            : 502,
      },
    );
  }

  const generationId = upstream.headers.get("X-Generation-Id");
  const ttsCostCents = await estimateOpenRouterTtsCostCents(
    supabase,
    text.length,
  );
  void insertUsageEvent(supabase, {
    kind: "tts",
    label: "TTS OpenRouter",
    modelId: model,
    providerRef: generationId,
    characters: text.length,
    costCents: ttsCostCents,
  });

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
      ...(ttsCostCents > 0
        ? { [TTS_COST_HEADER]: String(ttsCostCents) }
        : {}),
    },
  });
}
