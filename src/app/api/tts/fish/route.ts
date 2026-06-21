import { NextResponse } from "next/server";
import { TTS_COST_HEADER } from "@/lib/llm/openRouterCompletion";
import { estimateFishTtsCostCents } from "@/lib/server/billingSettings";
import {
  getFishAudioApiKey,
  isServerFishAudioTtsConfigured,
} from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { isSaasMode } from "@/lib/server/deploymentMode";
import { requireApiActor } from "@/lib/server/requireApiActor";
import { readBearerClientKey } from "@/lib/server/ttsClientKeys";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getRateLimitTtsPerHour } from "@/lib/server/env";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";
import { insertUsageEvent } from "@/lib/server/usageEvents";
import { applyUsageCharge, requireSpendableBalance } from "@/lib/server/wallet";
import {
  looksLikeFishReferenceId,
  normalizeFishAudioModel,
  normalizeFishAudioReferenceId,
} from "@/lib/tts/fishAudioVoices";
import { formatFishAudioTtsError } from "@/lib/tts/fishAudioErrors";

const FISH_TTS_URL = "https://api.fish.audio/v1/tts";

export async function GET() {
  return NextResponse.json({
    serverFishAudioTts: isServerFishAudioTtsConfigured(),
  });
}

/** Fish Audio S2-Pro — SaaS server key or browser key (local deployment). */
export async function POST(req: Request) {
  const auth = await requireApiActor(req);
  if ("error" in auth) return auth.error;

  const saas = isSaasMode();
  const supabase = saas ? await createServerSupabaseFromRequest(req) : null;

  if (saas && supabase) {
    const balanceErr = await requireSpendableBalance(supabase, auth.user.id, 1);
    if (balanceErr) return balanceErr;
  }

  const ttsPerHour =
    saas && supabase
      ? await getTtsHourlyLimitForUser(supabase, auth.user.id)
      : getRateLimitTtsPerHour();
  const limit = checkRateLimit(`tts-fish:${auth.user.id}`, ttsPerHour);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const serverKey = getFishAudioApiKey();
  const clientKey = readBearerClientKey(req);
  const apiKey = saas ? (serverKey ?? clientKey) : clientKey;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: saas
          ? "Fish Audio TTS not configured. Set FISH_AUDIO_API_KEY on the server."
          : "Fish Audio API-Key in Einstellungen eintragen (wird nur lokal im Browser gespeichert).",
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
  if (!looksLikeFishReferenceId(referenceId)) {
    return NextResponse.json(
      {
        error:
          "Ungültige Fish reference_id (32-stellige Hex-ID von fish.audio). Kokoro/Eleven-Stimmen funktionieren nicht — in Einstellungen oder Lesezeichen-ID speichern.",
        code: "fish_bad_reference",
        referenceId,
      },
      { status: 400 },
    );
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
    const formatted = formatFishAudioTtsError(upstream.status, errText);
    const clientStatus =
      upstream.status === 401 || upstream.status === 403
        ? 502
        : upstream.status >= 400 && upstream.status < 600
          ? upstream.status
          : 502;
    return NextResponse.json(
      {
        error: formatted.message,
        code: formatted.code,
        model,
        referenceId,
        upstreamStatus: upstream.status,
      },
      {
        status: clientStatus,
        headers: {
          "X-Tts-Error-Source":
            upstream.status === 401 || upstream.status === 403
              ? "fish-upstream-auth"
              : "fish-upstream",
        },
      },
    );
  }

  const utf8Bytes = new TextEncoder().encode(text).length;
  let ttsCostCents = 0;
  if (saas && supabase) {
    ttsCostCents = await estimateFishTtsCostCents(supabase, utf8Bytes);
    void insertUsageEvent(supabase, {
      kind: "tts",
      label: "TTS Fish Audio",
      modelId: model,
      characters: text.length,
      costCents: ttsCostCents,
    });
    void applyUsageCharge(supabase, ttsCostCents);
  }

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
