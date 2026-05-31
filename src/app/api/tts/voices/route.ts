import { NextResponse } from "next/server";
import {
  getElevenLabsVoiceCatalog,
  getElevenLabsVoiceCatalogStatic,
} from "@/lib/server/elevenLabsCatalog";
import { getElevenLabsApiKey } from "@/lib/server/env";
import { requireUser } from "@/lib/server/requireUser";

/** Curated ElevenLabs voices with free preview_url (no synthesis credits). */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const voices = getElevenLabsApiKey()
      ? await getElevenLabsVoiceCatalog()
      : getElevenLabsVoiceCatalogStatic();
    return NextResponse.json(
      { voices },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voice catalog failed" },
      { status: 502 },
    );
  }
}
