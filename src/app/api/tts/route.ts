import { NextResponse } from "next/server";
import {
  getElevenLabsApiKey,
  getRateLimitTtsPerHour,
  isServerTtsConfigured,
} from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import {
  getDefaultElevenLabsModel,
  getElevenLabsVoiceSettings,
} from "@/lib/tts/elevenLabsVoices";

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

  const limit = checkRateLimit(
    `tts:${auth.user.id}`,
    getRateLimitTtsPerHour(),
  );
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
  const voiceId = body.voiceId?.trim();
  const modelId = body.modelId?.trim() || getDefaultElevenLabsModel();
  const locale = body.locale?.startsWith("de") ? "de" : "en";

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

  const upstream = await fetch(
    `${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
    },
  );

  if (!upstream.ok) {
    const errText = await upstream.text();
    return NextResponse.json(
      { error: errText || upstream.statusText },
      { status: upstream.status },
    );
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
