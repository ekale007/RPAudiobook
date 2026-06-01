import { NextResponse } from "next/server";

/** Proxy to your local TTS server (edge-tts / Kokoro / Qwen) on the same PC as Next.js. */
export async function POST(req: Request) {
  let body: {
    text?: string;
    voice?: string;
    serverUrl?: string;
    language?: string;
    instruct?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  const voice = body.voice?.trim() || "en-US-AndrewNeural";
  const serverUrl =
    body.serverUrl?.trim() ||
    process.env.LOCAL_TTS_URL ||
    "http://127.0.0.1:5123";

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const base = serverUrl.replace(/\/$/, "");
  const payload: Record<string, string | null> = { text, voice };
  if (body.language?.trim()) payload.language = body.language.trim();
  if (body.instruct?.trim()) payload.instruct = body.instruct.trim();

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Cannot reach local TTS at ${base}. Start it with: npm run tts:server (${msg})`,
      },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return NextResponse.json(
      { error: errText || upstream.statusText },
      { status: upstream.status },
    );
  }

  const contentType =
    upstream.headers.get("content-type") || "audio/mpeg";
  const audio = await upstream.arrayBuffer();

  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
