import { NextResponse } from "next/server";
import { TTS_COST_HEADER } from "@/lib/llm/openRouterCompletion";
import { estimateFalTtsCostCents } from "@/lib/server/billingSettings";
import {
  getFalApiKey,
  isServerFalTtsConfigured,
} from "@/lib/server/env";
import { FalTtsUpstreamError, synthesizeFalTts } from "@/lib/server/falTts";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";
import { insertUsageEvent } from "@/lib/server/usageEvents";
import { applyUsageCharge, requireSpendableBalance } from "@/lib/server/wallet";
import {
  falTtsMaxChars,
  formatFalTtsError,
  normalizeFalTtsModel,
  normalizeFalTtsVoice,
} from "@/lib/tts/falTtsModels";

export async function GET() {
  return NextResponse.json({
    serverFalTts: isServerFalTtsConfigured(),
  });
}

/** fal.ai TTS — server key via FAL_API_KEY / FAL_KEY. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const balanceErr = await requireSpendableBalance(supabase, auth.user.id, 1);
  if (balanceErr) return balanceErr;

  const ttsPerHour = await getTtsHourlyLimitForUser(supabase, auth.user.id);
  const limit = checkRateLimit(`tts-fal:${auth.user.id}`, ttsPerHour);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const apiKey = getFalApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "fal.ai TTS not configured. Set FAL_API_KEY or FAL_KEY on the server.",
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
  const model = normalizeFalTtsModel(body.model);
  const voice = normalizeFalTtsVoice(model, body.voice);
  const maxChars = falTtsMaxChars(model);

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > maxChars) {
    return NextResponse.json(
      { error: `Text too long for single chunk (max ${maxChars})` },
      { status: 400 },
    );
  }

  try {
    const { audio, contentType } = await synthesizeFalTts(
      apiKey,
      model,
      text,
      voice,
    );

    const ttsCostCents = await estimateFalTtsCostCents(
      supabase,
      text.length,
      model,
    );
    void insertUsageEvent(supabase, {
      kind: "tts",
      label: "TTS fal.ai",
      modelId: model,
      characters: text.length,
      costCents: ttsCostCents,
    });
    void applyUsageCharge(supabase, ttsCostCents);

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
        ...(ttsCostCents > 0
          ? { [TTS_COST_HEADER]: String(ttsCostCents) }
          : {}),
      },
    });
  } catch (e) {
    if (e instanceof FalTtsUpstreamError) {
      const clientStatus =
        e.status === 405 || e.status === 502 ? 502 : e.status;
      return NextResponse.json(
        {
          error: formatFalTtsError(e.status, e.rawBody),
          model,
          voice,
        },
        {
          status:
            clientStatus >= 400 && clientStatus < 600 ? clientStatus : 502,
        },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, model, voice }, { status: 502 });
  }
}
