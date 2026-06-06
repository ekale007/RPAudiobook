import { createClient } from "@/lib/supabase/client";
import {
  isLocalEntityId,
  patchLocalTurnCosts,
  truncateLocalTurnsFrom,
  updateLocalTurnContent,
} from "@/lib/db/localStories";
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

export async function removeTurnAudio(
  path: string | null | undefined,
): Promise<void> {
  if (!path) return;
  const supabase = createClient();
  await supabase.storage.from("tts-audio").remove([path]);
}

export async function patchTurnCosts(
  turnId: string,
  patch: { llmCostCents?: number; ttsCostCents?: number },
  storyId?: string,
): Promise<void> {
  if (isLocalEntityId(turnId)) {
    await patchLocalTurnCosts(turnId, patch, storyId);
    return;
  }
  const supabase = createClient();
  const row: Record<string, number> = {};
  if (patch.llmCostCents != null && patch.llmCostCents >= 0) {
    row.llm_cost_cents = patch.llmCostCents;
  }
  if (patch.ttsCostCents != null && patch.ttsCostCents >= 0) {
    row.tts_cost_cents = patch.ttsCostCents;
  }
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from("turns").update(row).eq("id", turnId);
  if (error) throw error;
  if (storyId) await touchStoryUpdated(storyId);
}

export async function updateTurnContent(
  turnId: string,
  content: string,
  storyId?: string,
): Promise<void> {
  if (isLocalEntityId(turnId)) {
    await updateLocalTurnContent(turnId, content, storyId);
    return;
  }
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
  if (isLocalEntityId(chapterId)) {
    return truncateLocalTurnsFrom(chapterId, fromIndex, storyId);
  }
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
