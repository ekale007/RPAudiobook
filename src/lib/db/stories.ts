import { createClient } from "@/lib/supabase/client";
import type {
  StorySettings,
  WryTourCharacter,
  WryTourLorebook,
} from "@/lib/types";
import { DEFAULT_STORY_SETTINGS } from "@/lib/types";
import type { WryTourSeedPack } from "@/lib/import/wrytour";

export interface StoryRow {
  id: string;
  title: string;
  locale: string;
  settings: Record<string, unknown>;
}

export interface ChapterRow {
  id: string;
  band_id: string;
  index_in_band: number;
  title: string;
  status: string;
  chapter_summary: string | null;
  rolling_summary: string | null;
  phase_hint?: string | null;
}

export interface TurnRow {
  id: string;
  chapter_id: string;
  index_in_chapter: number;
  role: string;
  content: string;
  created_at: string;
  audio_storage_path?: string | null;
  speaker_slug?: string | null;
}

export function parseStorySettings(raw: unknown): StorySettings {
  const o = (raw ?? {}) as Partial<StorySettings>;
  return { ...DEFAULT_STORY_SETTINGS, ...o };
}

export async function listStories(): Promise<StoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("id, title, locale, settings")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function importWhenDawnBreaks(
  userId: string,
  pack: WryTourSeedPack,
): Promise<{ storyId: string; chapterId: string }> {
  const supabase = createClient();

  const { data: story, error: storyErr } = await supabase
    .from("stories")
    .insert({
      user_id: userId,
      title: "When Dawn Breaks",
      locale: "en",
      settings: {
        recentTurnCount: 16,
        loreTokenBudget: 3500,
        chatMode: "narrator",
      },
    })
    .select("id")
    .single();

  if (storyErr) throw storyErr;

  const storyId = story.id as string;

  const narrator = pack.characters.find((c) => c.role === "narrator");
  if (!narrator) throw new Error("Seed pack missing narrator");

  for (const { slug, role, card } of pack.characters) {
    const { error } = await supabase.from("characters").insert({
      user_id: userId,
      story_id: storyId,
      slug,
      role,
      name: card.name,
      card_json: card,
    });
    if (error) throw error;
  }

  const lorebookIds: string[] = [];
  for (const { slug, book } of pack.lorebooks) {
    const { data: lb, error } = await supabase
      .from("lorebooks")
      .insert({
        user_id: userId,
        story_id: storyId,
        slug,
        name: book.name,
        book_json: book,
      })
      .select("id")
      .single();
    if (error) throw error;
    lorebookIds.push(lb.id as string);
  }

  for (const lid of lorebookIds) {
    const { error } = await supabase.from("story_lorebooks").insert({
      story_id: storyId,
      lorebook_id: lid,
    });
    if (error) throw error;
  }

  const { data: band, error: bandErr } = await supabase
    .from("bands")
    .insert({
      story_id: storyId,
      index_in_story: 1,
      title: "Volume I — The Countdown",
    })
    .select("id")
    .single();
  if (bandErr) throw bandErr;

  const { data: chapter, error: chErr } = await supabase
    .from("chapters")
    .insert({
      band_id: band.id,
      index_in_band: 1,
      title: "Chapter 1 — When Dawn Breaks",
      status: "active",
      phase_hint: "Hours 0-4 (Shock)",
    })
    .select("id")
    .single();
  if (chErr) throw chErr;

  const firstMes = narrator.card.first_mes ?? "";
  if (firstMes) {
    const { error: turnErr } = await supabase.from("turns").insert({
      chapter_id: chapter.id,
      index_in_chapter: 0,
      role: "assistant",
      content: firstMes,
    });
    if (turnErr) throw turnErr;
  }

  return { storyId, chapterId: chapter.id as string };
}

export interface BandRow {
  id: string;
  story_id: string;
  index_in_story: number;
  title: string;
  band_summary: string | null;
}

export interface CharacterRow {
  id: string;
  slug: string;
  role: string;
  name: string;
  card_json: WryTourCharacter;
}

export async function updateStorySettings(
  storyId: string,
  patch: Partial<StorySettings>,
): Promise<StorySettings> {
  const supabase = createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("stories")
    .select("settings")
    .eq("id", storyId)
    .single();
  if (fetchErr) throw fetchErr;

  const merged = { ...parseStorySettings(row.settings), ...patch };
  const { error } = await supabase
    .from("stories")
    .update({
      settings: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storyId);
  if (error) throw error;
  return merged;
}

export async function touchStoryUpdated(storyId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("stories")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", storyId);
}

export async function getStoryOverview(storyId: string) {
  const bundle = await getStoryBundle(storyId);
  const { data: castList, error } = await createClient()
    .from("characters")
    .select("id, slug, role, name")
    .eq("story_id", storyId)
    .order("role");
  if (error) throw error;
  return {
    ...bundle,
    cast: castList ?? [],
    storySettings: bundle.storySettings,
  };
}

export async function listCharacters(storyId: string): Promise<CharacterRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id, slug, role, name, card_json")
    .eq("story_id", storyId)
    .order("role");
  if (error) throw error;
  return (data ?? []) as CharacterRow[];
}

export async function listLorebooksForStory(storyId: string) {
  const supabase = createClient();
  const { data: links, error: lErr } = await supabase
    .from("story_lorebooks")
    .select("lorebook_id")
    .eq("story_id", storyId);
  if (lErr) throw lErr;
  const ids = (links ?? []).map((l) => l.lorebook_id as string);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("lorebooks")
    .select("id, slug, name, book_json")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function getStoryBundle(
  storyId: string,
  preferredChapterId?: string,
) {
  const supabase = createClient();

  const { data: story, error: sErr } = await supabase
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .single();
  if (sErr) throw sErr;

  const { data: characters, error: cErr } = await supabase
    .from("characters")
    .select("*")
    .eq("story_id", storyId);
  if (cErr) throw cErr;

  const { data: links, error: lErr } = await supabase
    .from("story_lorebooks")
    .select("lorebook_id")
    .eq("story_id", storyId);
  if (lErr) throw lErr;

  const lorebookIds = (links ?? []).map((l) => l.lorebook_id as string);
  let lorebooks: Array<{ book_json: WryTourLorebook }> = [];
  if (lorebookIds.length) {
    const { data: lbs, error: lbErr } = await supabase
      .from("lorebooks")
      .select("book_json")
      .in("id", lorebookIds);
    if (lbErr) throw lbErr;
    lorebooks = (lbs ?? []) as Array<{ book_json: WryTourLorebook }>;
  }

  const narrator = (characters ?? []).find((c) => c.role === "narrator");
  if (!narrator) throw new Error("No narrator on story");

  const { data: bands, error: bErr } = await supabase
    .from("bands")
    .select("*")
    .eq("story_id", storyId)
    .order("index_in_story");
  if (bErr) throw bErr;

  const band = bands?.[0];
  if (!band) throw new Error("No band on story");

  const { data: chapters, error: chErr } = await supabase
    .from("chapters")
    .select("*")
    .eq("band_id", band.id)
    .order("index_in_band");
  if (chErr) throw chErr;

  const activeChapter =
    (preferredChapterId
      ? chapters?.find((c) => c.id === preferredChapterId)
      : undefined) ??
    chapters?.find((c) => c.status === "active") ??
    chapters?.[chapters.length - 1];
  if (!activeChapter) throw new Error("No chapter");

  const cast = ((characters ?? []) as CharacterRow[])
    .filter((c) => c.role === "cast")
    .map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      role: c.role as string,
      name: c.name as string,
      card_json: c.card_json as WryTourCharacter,
    }));

  return {
    story,
    narrator: narrator.card_json as WryTourCharacter,
    cast,
    storySettings: parseStorySettings(story.settings),
    loreEntries: lorebooks.flatMap((lb) => lb.book_json.entries ?? []),
    band,
    chapters: chapters ?? [],
    activeChapter: activeChapter as ChapterRow,
  };
}

export async function getTurns(chapterId: string): Promise<TurnRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("turns")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("index_in_chapter");
  if (error) throw error;
  return (data ?? []) as TurnRow[];
}

export async function appendTurn(
  chapterId: string,
  index: number,
  role: "user" | "assistant",
  content: string,
  storyId?: string,
  speakerSlug?: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("turns").insert({
    chapter_id: chapterId,
    index_in_chapter: index,
    role,
    content,
    speaker_slug: speakerSlug ?? null,
  });
  if (error) throw error;
  if (storyId) await touchStoryUpdated(storyId);
}

export async function appendAssistantBlocks(
  chapterId: string,
  startIndex: number,
  blocks: Array<{ speakerSlug: string; content: string }>,
  storyId?: string,
): Promise<void> {
  for (let i = 0; i < blocks.length; i++) {
    await appendTurn(
      chapterId,
      startIndex + i,
      "assistant",
      blocks[i].content,
      storyId,
      blocks[i].speakerSlug,
    );
  }
}

export async function updateChapterSummaries(
  chapterId: string,
  patch: {
    rolling_summary?: string;
    chapter_summary?: string;
    status?: string;
    closed_at?: string;
  },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chapters")
    .update(patch)
    .eq("id", chapterId);
  if (error) throw error;
}

export async function updateChapterTitle(
  chapterId: string,
  title: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chapters")
    .update({ title })
    .eq("id", chapterId);
  if (error) throw error;
}

export async function createNextChapter(
  bandId: string,
  index: number,
  title: string,
  phaseHint?: string,
): Promise<ChapterRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chapters")
    .insert({
      band_id: bandId,
      index_in_band: index,
      title,
      status: "active",
      phase_hint: phaseHint ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChapterRow;
}

export async function updateBandSummary(
  bandId: string,
  summary: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bands")
    .update({ band_summary: summary })
    .eq("id", bandId);
  if (error) throw error;
}
