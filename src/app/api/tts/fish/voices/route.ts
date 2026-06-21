import { NextResponse } from "next/server";
import { getFishAudioVoiceCatalog } from "@/lib/server/fishAudioCatalog";
import { loadFishAudioPinnedIdsForUser } from "@/lib/server/fishAudioUserPinned";
import { isSaasMode } from "@/lib/server/deploymentMode";
import { requireApiActor } from "@/lib/server/requireApiActor";
import { readBearerClientKey } from "@/lib/server/ttsClientKeys";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { normalizeFishAudioPinnedIds } from "@/lib/tts/fishAudioVoices";

/** Fish Audio voices: pinned IDs + own clones (browser key in local deployment). */
export async function GET(req: Request) {
  const auth = await requireApiActor(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const pinnedRaw = url.searchParams.get("pinned")?.trim() ?? "";
  const queryPinned = normalizeFishAudioPinnedIds(
    pinnedRaw ? pinnedRaw.split(",") : [],
  );

  const saas = isSaasMode();
  let pinnedIds = queryPinned;
  if (saas) {
    const supabase = await createServerSupabaseFromRequest(req);
    pinnedIds = await loadFishAudioPinnedIdsForUser(
      supabase,
      auth.user.id,
      queryPinned,
    );
  }

  const clientKey = readBearerClientKey(req);

  try {
    const catalog = await getFishAudioVoiceCatalog(pinnedIds, clientKey);
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
