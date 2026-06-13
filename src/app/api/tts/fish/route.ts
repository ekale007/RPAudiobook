import { NextResponse } from "next/server";
import { TTS_COST_HEADER } from "@/lib/llm/openRouterCompletion";
import { estimateFishTtsCostCents } from "@/lib/server/billingSettings";
import {
  getFishAudioApiKey,
  isServerFishAudioTtsConfigured,
} from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";
import { insertUsageEvent } from "@/lib/server/usageEvents";
import {
  normalizeFishAudioModel,
  normalizeFishAudioReferenceId,
} from "@/lib/tts/fishAudioVoices";

const FISH_TTS_URL = "https://api.fish.audio/v1/tts";

export async function GET() {
  return NextResponse.json({
    serverFishAudioTts: isServerFishAudioTtsConfigured(),
  });
}

/** Fish Audio S2-Pro — server key. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const ttsPerHour = await getTtsHourlyLimitForUser(supabase, auth.user.id);
  const limit = checkRateLimit(`tts-fish:${auth.user.id}`, ttsPerHour);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const apiKey = getFishAudioApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Fish Audio TTS not configured. Set FISH_AUDIO_API_KEY on the server.",
      },
      { status: 503 },
    );
  }

  let body: {
    text?: string;
    referenceId?: string;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  const model = normalizeFishAudioModel(body.model);
  const referenceId = normalizeFishAudioReferenceId(body.referenceId);

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > 2400) {
    return NextResponse.json(
      { error: "Text too long for single chunk (max 2400)" },
      { status: 400 },
    );
  }

  const upstream = await fetch(FISH_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model,
    },
    body: JSON.stringify({
      text,
      reference_id: referenceId,
      format: "mp3",
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    let message = errText?.slice(0, 800) || upstream.statusText || "TTS failed";
    try {
      const parsed = JSON.parse(errText) as { message?: string; error?: string };
      if (parsed.message?.trim()) message = parsed.message.trim();
      else if (parsed.error?.trim()) message = parsed.error.trim();
    } catch {
      /* plain text */
    }
    return NextResponse.json(
      { error: message, model, referenceId },
      { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
    );
  }

  const utf8Bytes = new TextEncoder().encode(text).length;
  const ttsCostCents = await estimateFishTtsCostCents(supabase, utf8Bytes);
  void insertUsageEvent(supabase, {
    kind: "tts",
    label: "TTS Fish Audio",
    modelId: model,
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
