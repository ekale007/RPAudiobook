import { NextResponse } from "next/server";
import {
  getElevenLabsVoiceCatalog,
  getElevenLabsVoiceCatalogStatic,
} from "@/lib/server/elevenLabsCatalog";
import { getElevenLabsApiKey } from "@/lib/server/env";
import { requireUser } from "@/lib/server/requireUser";
import { ELEVEN_TTS_MODEL_OPTIONS } from "@/lib/tts/elevenLabsModels";

/** Curated ElevenLabs voices with free preview_url (no synthesis credits). */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const voices = getElevenLabsApiKey()
      ? await getElevenLabsVoiceCatalog()
      : getElevenLabsVoiceCatalogStatic();
    return NextResponse.json(
      { voices, models: ELEVEN_TTS_MODEL_OPTIONS },
      { headers: { "Cache-Control": "private, max-age=900" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voice catalog failed" },
      { status: 502 },
    );
  }
}
