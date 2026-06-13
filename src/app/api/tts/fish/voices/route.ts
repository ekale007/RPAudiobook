import { NextResponse } from "next/server";
import { getFishAudioVoiceCatalog } from "@/lib/server/fishAudioCatalog";
import { loadFishAudioPinnedIdsForUser } from "@/lib/server/fishAudioUserPinned";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { normalizeFishAudioPinnedIds } from "@/lib/tts/fishAudioVoices";

/** Fish Audio voices: saved IDs from account + optional query merge, own clones. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const pinnedRaw = url.searchParams.get("pinned")?.trim() ?? "";
  const queryPinned = normalizeFishAudioPinnedIds(
    pinnedRaw ? pinnedRaw.split(",") : [],
  );

  const supabase = await createServerSupabaseFromRequest(req);
  const pinnedIds = await loadFishAudioPinnedIdsForUser(
    supabase,
    auth.user.id,
    queryPinned,
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
