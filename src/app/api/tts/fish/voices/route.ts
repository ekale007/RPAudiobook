import { NextResponse } from "next/server";
import { getFishAudioVoiceCatalog } from "@/lib/server/fishAudioCatalog";
import { requireUser } from "@/lib/server/requireUser";
import { normalizeFishAudioPinnedIds } from "@/lib/tts/fishAudioVoices";

/** Fish Audio voices: clones, Lesezeichen (marked), and pinned IDs from settings. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const pinnedRaw = url.searchParams.get("pinned")?.trim() ?? "";
  const pinnedIds = normalizeFishAudioPinnedIds(
    pinnedRaw ? pinnedRaw.split(",") : [],
  );

  try {
    const catalog = await getFishAudioVoiceCatalog(pinnedIds);
    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voice catalog failed" },
      { status: 502 },
    );
  }
}
