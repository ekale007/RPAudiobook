import { NextResponse } from "next/server";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

/** Proxies ElevenLabs TTS so the API key stays client-side (header) and CORS is avoided. */
export async function POST(req: Request) {
  const apiKey = req.headers.get("xi-api-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing xi-api-key header" },
      { status: 401 },
    );
  }

  let body: { text?: string; voiceId?: string; modelId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  const voiceId = body.voiceId?.trim();
  const modelId = body.modelId?.trim() || "eleven_multilingual_v2";

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
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
        },
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
