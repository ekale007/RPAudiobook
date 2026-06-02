import type { SupabaseClient } from "@supabase/supabase-js";

export const TTS_STORAGE_MAX_DEFAULT = 100;

export function getTtsStorageMaxPerUser(): number {
  const raw = process.env.TTS_STORAGE_MAX_PER_USER?.trim();
  const n = raw ? parseInt(raw, 10) : TTS_STORAGE_MAX_DEFAULT;
  return Number.isFinite(n) && n > 0 ? n : TTS_STORAGE_MAX_DEFAULT;
}

export async function countUserTtsRecordings(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase.rpc("count_user_tts_recordings");
  if (error) {
    console.warn("count_user_tts_recordings:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export type TurnStorageRow = {
  id: string;
  audio_storage_path: string | null;
};

function storyOwnerIdFromTurnJoin(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const chapters = (data as { chapters?: unknown }).chapters;
  const chapter = Array.isArray(chapters) ? chapters[0] : chapters;
  if (!chapter || typeof chapter !== "object") return null;
  const bands = (chapter as { bands?: unknown }).bands;
  const band = Array.isArray(bands) ? bands[0] : bands;
  if (!band || typeof band !== "object") return null;
  const stories = (band as { stories?: unknown }).stories;
  const story = Array.isArray(stories) ? stories[0] : stories;
  if (!story || typeof story !== "object") return null;
  const uid = (story as { user_id?: unknown }).user_id;
  return typeof uid === "string" ? uid : null;
}

/** Returns turn row if owned by userId; otherwise null. */
export async function getTurnForCloudStorage(
  supabase: SupabaseClient,
  turnId: string,
  userId: string,
): Promise<TurnStorageRow | null> {
  const { data, error } = await supabase
    .from("turns")
    .select(
      `
      id,
      audio_storage_path,
      chapters!inner (
        bands!inner (
          stories!inner ( user_id )
        )
      )
    `,
    )
    .eq("id", turnId)
    .maybeSingle();

  if (error || !data) return null;
  const ownerId = storyOwnerIdFromTurnJoin(data);
  if (ownerId !== userId) return null;
  return {
    id: String((data as { id: string }).id),
    audio_storage_path:
      (data as { audio_storage_path?: string | null }).audio_storage_path ??
      null,
  };
}

export function canStoreNewTtsRecording(
  used: number,
  max: number,
  existingPath: string | null | undefined,
): boolean {
  if (existingPath?.trim()) return true;
  return used < max;
}
