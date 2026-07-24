/**
 * Google Cloud Text-to-Speech — free tier: 1M chars/month.
 *
 * Uses the REST API (not gRPC) with an API key. The key must have the
 * Cloud Text-to-Speech API enabled in the Google Cloud Console.
 *
 * Voice selection: the client sends a `voiceId` which is mapped to a
 * Google Cloud voice name (e.g. "de-DE-Wavenet-C").
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { getTtsHourlyLimitForUser } from "@/lib/server/userTier";
import { requireSpendableBalance } from "@/lib/server/wallet";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

function getGoogleCloudTtsKey(): string | null {
  return process.env.GOOGLE_CLOUD_TTS_API_KEY?.trim() || null;
}

function isConfigured(): boolean {
  return Boolean(getGoogleCloudTtsKey());
}

export async function GET() {
  const key = getGoogleCloudTtsKey();
  if (!key) {
    return NextResponse.json({ configured: false, voices: [] });
  }
  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(key)}`,
    );
    if (!res.ok) return NextResponse.json({ configured: true, voices: [] });
    const json = (await res.json()) as { voices?: Array<{
      name: string;
      languageCodes: string[];
      ssmlGender: string;
      naturalSampleRateHertz: number;
    }> };
    const voices = (json.voices ?? []).map((v) => ({
      name: v.name,
      languageCodes: v.languageCodes,
      gender: v.ssmlGender,
    }));
    // Sort: German first, then alphabetically
    voices.sort((a, b) => {
      const aDe = a.languageCodes.some((c) => c.startsWith("de"));
      const bDe = b.languageCodes.some((c) => c.startsWith("de"));
      if (aDe !== bDe) return aDe ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return NextResponse.json({ configured: true, voices });
  } catch {
    return NextResponse.json({ configured: true, voices: [] });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const key = getGoogleCloudTtsKey();
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_CLOUD_TTS_API_KEY not configured" },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseFromRequest(req);

  let body: {
    text?: string;
    voiceId?: string;
    languageCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length > 5000) {
    return NextResponse.json(
      { error: "Missing text or too long (max 5000)" },
      { status: 400 },
    );
  }

  // Pre-flight: free up to 1M chars/month, charge 0 cents for now.
  const estMin = 1;
  const balanceErr = await requireSpendableBalance(supabase, auth.user.id, estMin);
  if (balanceErr) return balanceErr;

  const ttsPerHour = await getTtsHourlyLimitForUser(supabase, auth.user.id);
  const limit = checkRateLimit(`tts-google:${auth.user.id}`, ttsPerHour);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "TTS rate limit exceeded", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  // Map voiceId to Google Cloud voice name. Simple mapping for now.
  const voiceName = (body.voiceId?.trim() || "de-DE-Wavenet-C");
  const langCode = body.languageCode?.trim() || voiceName.split("-").slice(0, 2).join("-");

  const upstream = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: langCode,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Google TTS error ${upstream.status}: ${errText.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const json = (await upstream.json()) as { audioContent?: string };
  if (!json.audioContent) {
    return NextResponse.json(
      { error: "Google TTS returned no audio" },
      { status: 502 },
    );
  }

  const audio = Buffer.from(json.audioContent, "base64");
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
