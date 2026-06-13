import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeFishAudioPinnedIds,
} from "@/lib/tts/fishAudioVoices";

type TtsPrefsJson = {
  fishAudioPinnedIds?: string[];
};

/** Pinned Fish IDs from account prefs (merged with optional query list). */
export async function loadFishAudioPinnedIdsForUser(
  supabase: SupabaseClient,
  userId: string,
  queryPinned: string[] = [],
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("tts")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("fish pinned prefs:", error.message);
  }

  const remote = (data?.tts as TtsPrefsJson | null)?.fishAudioPinnedIds;
  return normalizeFishAudioPinnedIds([...(remote ?? []), ...queryPinned]);
}
