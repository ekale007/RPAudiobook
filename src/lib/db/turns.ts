import { createClient } from "@/lib/supabase/client";
import {
  getTurns,
  touchStoryUpdated,
  type TurnRow,
} from "@/lib/db/stories";

async function reindexTurns(turns: TurnRow[]): Promise<void> {
  const supabase = createClient();
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].index_in_chapter !== i) {
      const { error } = await supabase
        .from("turns")
        .update({ index_in_chapter: i })
        .eq("id", turns[i].id);
      if (error) throw error;
    }
  }
}

async function removeTurnAudio(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const supabase = createClient();
  await supabase.storage.from("tts-audio").remove([path]);
}

export async function updateTurnContent(
  turnId: string,
  content: string,
  storyId?: string,
): Promise<void> {
  const supabase = createClient();
  const { data: row } = await supabase
    .from("turns")
    .select("audio_storage_path")
    .eq("id", turnId)
    .single();

  if (row?.audio_storage_path) {
    await removeTurnAudio(row.audio_storage_path as string);
  }

  const { error } = await supabase
    .from("turns")
    .update({ content, audio_storage_path: null })
    .eq("id", turnId);
  if (error) throw error;
  if (storyId) await touchStoryUpdated(storyId);
}

/** Delete this turn and everything after it; reindex remaining. */
export async function truncateTurnsFrom(
  chapterId: string,
  fromIndex: number,
  storyId?: string,
): Promise<TurnRow[]> {
  const supabase = createClient();
  const all = await getTurns(chapterId);
  const victims = all.filter((t) => t.index_in_chapter >= fromIndex);

  for (const t of victims) {
    await removeTurnAudio(t.audio_storage_path);
  }

  if (victims.length) {
    const ids = victims.map((t) => t.id);
    const { error } = await supabase.from("turns").delete().in("id", ids);
    if (error) throw error;
  }

  const remaining = all.filter((t) => t.index_in_chapter < fromIndex);
  await reindexTurns(remaining);
  if (storyId) await touchStoryUpdated(storyId);
  return getTurns(chapterId);
}
