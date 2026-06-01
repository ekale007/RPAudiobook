import { NextResponse } from "next/server";
import {
  getQwenTtsApiKey,
  getQwenTtsUrl,
  getRateLimitTtsPerHour,
  isServerQwenTtsConfigured,
} from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";

export async function GET() {
  return NextResponse.json({
    serverQwenTts: isServerQwenTtsConfigured(),
  });
}

/** Qwen3-TTS on RunPod or self-hosted GPU — proxied with auth + rate limit. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const limit = checkRateLimit(
    `tts-qwen:${auth.user.id}`,
    getRateLimitTtsPerHour(),
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const baseUrl = getQwenTtsUrl();
  if (!baseUrl) {
    return NextResponse.json(
      {
        error:
          "Qwen TTS not configured. Set QWEN_TTS_URL (RunPod proxy URL) on the server.",
      },
      { status: 503 },
    );
  }

  let body: {
    text?: string;
    voice?: string;
    language?: string;
    instruct?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  const voice = body.voice?.trim() || "Ryan";
  const language = body.language?.trim() || "Auto";
  const instruct = body.instruct?.trim() || null;

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json(
      { error: "Text too long for single chunk (max 4000)" },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = getQwenTtsApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const base = baseUrl.replace(/\/$/, "");
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/speak`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, voice, language, instruct }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Cannot reach Qwen TTS at ${base} (${msg})` },
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

  const contentType = upstream.headers.get("content-type") || "audio/wav";
  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
