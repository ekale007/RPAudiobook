import { NextResponse } from "next/server";
import {
  getQwenTtsApiKey,
  getQwenTtsUrl,
  getRateLimitTtsPerHour,
  getRunPodApiKey,
  isRunPodServerlessQwenUrl,
  isServerQwenTtsConfigured,
} from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";

export async function GET() {
  return NextResponse.json({
    serverQwenTts: isServerQwenTtsConfigured(),
  });
}

/** Qwen3-TTS on RunPod or self-hosted GPU — proxied with auth + rate limit. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const ttsPerHour = await getTtsHourlyLimitForUser(supabase, auth.user.id);
  const limit = checkRateLimit(`tts-qwen:${auth.user.id}`, ttsPerHour);
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
  const qwenKey = getQwenTtsApiKey();
  if (qwenKey) {
    headers["X-API-Key"] = qwenKey;
  }
  const runPodKey = getRunPodApiKey();
  if (isRunPodServerlessQwenUrl(baseUrl)) {
    if (!runPodKey) {
      return NextResponse.json(
        {
          error:
            "RunPod Serverless URL set but RUNPOD_API_KEY missing on the server.",
        },
        { status: 503 },
      );
    }
    headers.Authorization = `Bearer ${runPodKey}`;
  }

  const base = baseUrl.replace(/\/$/, "");
  const payload = JSON.stringify({ text, voice, language, instruct });
  const speakUrl = `${base}/speak`;
  const maxAttempts = isRunPodServerlessQwenUrl(baseUrl) ? 3 : 1;
  let upstream: Response | null = null;
  let lastErr = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      upstream = await fetch(speakUrl, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(330_000),
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 8_000));
        continue;
      }
      return NextResponse.json(
        { error: `Cannot reach Qwen TTS at ${base} (${lastErr})` },
        { status: 503 },
      );
    }

    if (
      upstream.status === 502 ||
      upstream.status === 503 ||
      upstream.status === 504
    ) {
      lastErr = await upstream.text();
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 10_000));
        continue;
      }
    } else {
      break;
    }
  }

  if (!upstream) {
    return NextResponse.json(
      { error: `Cannot reach Qwen TTS at ${base}` },
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
