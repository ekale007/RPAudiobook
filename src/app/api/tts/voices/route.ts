import { NextResponse } from "next/server";
import { getElevenLabsVoiceCatalog } from "@/lib/server/elevenLabsCatalog";
import { ELEVEN_CATALOG_REVISION } from "@/lib/server/elevenLabsAccount";
import { requireUser } from "@/lib/server/requireUser";
import { ELEVEN_TTS_MODEL_OPTIONS } from "@/lib/tts/elevenLabsModels";

/** Curated ElevenLabs voices with free preview_url (no synthesis credits). */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const catalog = await getElevenLabsVoiceCatalog();
    return NextResponse.json(
      {
        revision: ELEVEN_CATALOG_REVISION,
        voices: catalog.voices,
        source: catalog.source,
        hint: catalog.hint,
        models: ELEVEN_TTS_MODEL_OPTIONS,
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voice catalog failed" },
      { status: 502 },
    );
  }
}
