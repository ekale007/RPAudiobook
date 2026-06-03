import { NextResponse } from "next/server";
import { getElevenLabsAccountVoices } from "@/lib/server/elevenLabsAccount";
import {
  getElevenLabsApiKey,
  getRateLimitTtsPerHour,
  isServerTtsConfigured,
} from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";
import { insertUsageEvent } from "@/lib/server/usageEvents";
import { estimateTtsCostCents } from "@/lib/server/billingSettings";
import { readElevenLabsUsageHeaders } from "@/lib/server/ttsUsage";
import { isElevenV3Model } from "@/lib/tts/elevenLabsDelivery";
import {
  coerceElevenLabsVoiceId,
  getDefaultElevenLabsModel,
  getElevenLabsVoiceSettings,
} from "@/lib/tts/elevenLabsVoices";
import { normalizeElevenLabsModelId } from "@/lib/tts/elevenLabsModels";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

export async function GET() {
  return NextResponse.json({
    serverTts: isServerTtsConfigured(),
    model: getDefaultElevenLabsModel(),
  });
}

/** ElevenLabs TTS — server key in production; optional client header for dev fallback. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const ttsPerHour = await getTtsHourlyLimitForUser(supabase, auth.user.id);
  const limit = checkRateLimit(`tts:${auth.user.id}`, ttsPerHour);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const serverKey = getElevenLabsApiKey();
  const clientKey = req.headers.get("xi-api-key")?.trim();
  const apiKey = serverKey ?? clientKey;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "TTS not configured. Set ELEVENLABS_API_KEY on the server or enter your ElevenLabs key in Settings.",
      },
      { status: 503 },
    );
  }

  let body: {
    text?: string;
    voiceId?: string;
    speakerSlug?: string;
    modelId?: string;
    locale?: string;
    voiceSettings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  const locale = body.locale?.startsWith("de") ? "de" : "en";
  const speakerSlug = body.speakerSlug?.trim() || null;

  let allowedIds: Set<string>;
  try {
    ({ ids: allowedIds } = await getElevenLabsAccountVoices(apiKey));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "ElevenLabs-Stimmenliste konnte nicht geladen werden. API-Key prüfen.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  let voiceId = coerceElevenLabsVoiceId(
    body.voiceId,
    speakerSlug,
    locale,
    allowedIds,
  );
  let modelId = normalizeElevenLabsModelId(
    body.modelId?.trim() || getDefaultElevenLabsModel(),
  );

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (!voiceId) {
    return NextResponse.json({ error: "Missing voiceId" }, { status: 400 });
  }
  if (text.length > 2500) {
    return NextResponse.json(
      { error: "Text too long for single chunk (max 2500)" },
      { status: 400 },
    );
  }

  const voiceSettings = {
    ...getElevenLabsVoiceSettings(locale),
    ...body.voiceSettings,
  };

  const synthesize = (voice: string, model: string) =>
    fetch(`${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voice)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: voiceSettings,
      }),
    });

  const tryModels = [modelId];
  if (isElevenV3Model(modelId)) {
    tryModels.push("eleven_multilingual_v2", "eleven_turbo_v2_5");
  }

  let upstream: Response | null = null;
  let usedModel = modelId;
  let usedVoice = voiceId;
  const requestedVoice = body.voiceId?.trim() || null;

  for (const model of tryModels) {
    usedModel = model;
    usedVoice = voiceId;
    upstream = await synthesize(voiceId, model);
    if (upstream.ok) break;

    if (upstream.status === 404 && allowedIds.size > 0) {
      const fallbackVoice = coerceElevenLabsVoiceId(
        null,
        speakerSlug,
        locale,
        allowedIds,
      );
      if (fallbackVoice !== voiceId) {
        voiceId = fallbackVoice;
        usedVoice = voiceId;
        upstream = await synthesize(voiceId, model);
        if (upstream.ok) break;
      }
    }
  }

  if (!upstream?.ok) {
    const errText = await upstream?.text().catch(() => "") ?? "";
    const detail = errText?.slice(0, 800) || upstream?.statusText || "TTS failed";
    const speakerHint = speakerSlug
      ? ` (Sprecher: ${speakerSlug})`
      : "";
    if (upstream?.status === 404) {
      return NextResponse.json(
        {
          error: `Keine gültige ElevenLabs-Stimme${speakerHint}. Story → Cast: Stimme neu wählen (Liste kommt von deinem Eleven-Konto).`,
          voiceId: usedVoice,
          requestedVoiceId: requestedVoice,
          speakerSlug,
          modelId: usedModel,
          detail,
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      {
        error: detail,
        voiceId: usedVoice,
        speakerSlug,
        modelId: usedModel,
      },
      {
        status:
          upstream && upstream.status >= 400 && upstream.status < 600
            ? upstream.status
            : 502,
      },
    );
  }

  const elevenHeaders = readElevenLabsUsageHeaders(upstream.headers);
  const charCount =
    elevenHeaders.characters > 0 ? elevenHeaders.characters : text.length;
  const ttsCostCents = await estimateTtsCostCents(
    supabase,
    charCount,
    usedModel,
  );
  void insertUsageEvent(supabase, {
    kind: "tts",
    label: "TTS ElevenLabs",
    modelId: usedModel,
    providerRef: elevenHeaders.requestId,
    characters: charCount,
    costCents: ttsCostCents,
  });

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
      ...(usedVoice !== requestedVoice
        ? { "X-TTS-Voice-Coerced": usedVoice }
        : {}),
      ...(ttsCostCents > 0
        ? { "X-TTS-Cost-Cents": String(ttsCostCents) }
        : {}),
    },
  });
}
