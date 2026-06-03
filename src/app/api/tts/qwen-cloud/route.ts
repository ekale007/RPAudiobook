import { NextResponse } from "next/server";
import {
  isServerQwenCloudTtsConfigured,
  synthesizeDashScopeTts,
} from "@/lib/server/dashscopeTts";
import { getRateLimitTtsPerHour } from "@/lib/server/env";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";

export async function GET() {
  return NextResponse.json({
    serverQwenCloudTts: isServerQwenCloudTtsConfigured(),
  });
}

/** Qwen3-TTS via Alibaba DashScope (Qwen Cloud) — auth + rate limit. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const ttsPerHour = await getTtsHourlyLimitForUser(supabase, auth.user.id);
  const limit = checkRateLimit(`tts-qwen-cloud:${auth.user.id}`, ttsPerHour);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  if (!isServerQwenCloudTtsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Qwen Cloud TTS not configured. Set DASHSCOPE_API_KEY on the server.",
      },
      { status: 503 },
    );
  }

  let body: {
    text?: string;
    voice?: string;
    language?: string;
    instruct?: string | null;
    storyLocale?: string;
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

  try {
    const result = await synthesizeDashScopeTts(
      {
        text,
        voice,
        languageType: language,
        instruct,
      },
      { storyLocale: body.storyLocale },
    );
    return new NextResponse(result.audio, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Qwen-Cloud-Model": result.model,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
