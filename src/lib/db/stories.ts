import { createClient } from "@/lib/supabase/client";
import type { CharacterMemoryUpdate } from "@/lib/memory/characterMemory";
import { minimalCharacterCard } from "@/lib/memory/characterMemory";
import { parsePlotState } from "@/lib/memory/plotState";
import { parseStoryPins } from "@/lib/memory/storyPins";
import {
  DEFAULT_STORY_SETTINGS,
  type StorySettings,
  type WryTourCharacter,
  type WryTourLorebook,
} from "@/lib/types";
import type { WryTourSeedPack } from "@/lib/import/wrytour";
import type { StoryOrigin } from "@/lib/story/storyOrigin";
import {
  getLibraryTemplate,
  type LibraryTemplateId,
} from "@/lib/story/libraryTemplates";
import { getLibraryTemplateId } from "@/lib/story/storyOrigin";
import { defaultElevenVoiceMap } from "@/lib/tts/elevenLabsVoices";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export interface StoryRow {
  id: string;
  title: string;
  locale: string;
  settings: Record<string, unknown>;
  cover_storage_path?: string | null;
}

export function isStoryArchived(settings: unknown): boolean {
  const s = (settings ?? {}) as { archived?: unknown };
  return s.archived === true;
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
  const o = (raw ?? {}) as Partial<StorySettings> & {
    plotState?: unknown;
    pinnedNotes?: unknown;
  };
  return {
    ...DEFAULT_STORY_SETTINGS,
    ...o,
    plotState: parsePlotState(o.plotState),
    pinnedNotes: parseStoryPins(o.pinnedNotes),
  };
}

export async function listStories(includeArchived = false): Promise<StoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("id, title, locale, settings, cover_storage_path")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as StoryRow[];
  return includeArchived
    ? rows
    : rows.filter((r) => !isStoryArchived(r.settings));
}

export async function setStoryArchived(
  storyId: string,
  archived: boolean,
): Promise<void> {
  const supabase = createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("stories")
    .select("settings")
    .eq("id", storyId)
    .single();
  if (fetchErr) throw fetchErr;

  const current = (row.settings ?? {}) as Record<string, unknown>;
  const next = {
    ...current,
    archived,
    archivedAt: archived ? new Date().toISOString() : null,
  };
  const { error } = await supabase
    .from("stories")
    .update({ settings: next, updated_at: new Date().toISOString() })
    .eq("id", storyId);
  if (error) throw error;
}

export async function deleteStory(storyId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
}

export async function updateStoryTitle(
  storyId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Story title cannot be empty");
  const supabase = createClient();
  const { error } = await supabase
    .from("stories")
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq("id", storyId);
  if (error) throw error;
}

export interface CreateStoryFromPackOptions {
  userId: string;
  pack: WryTourSeedPack;
  title: string;
  locale?: string;
  bandTitle?: string;
  chapterTitle?: string;
  phaseHint?: string | null;
  settings?: Partial<StorySettings>;
  storyOrigin?: StoryOrigin;
  libraryTemplateId?: string | null;
  storyConcept?: string | null;
}

export async function createStoryFromSeedPack(
  opts: CreateStoryFromPackOptions,
): Promise<{ storyId: string; chapterId: string }> {
  const supabase = createClient();
  const {
    userId,
    pack,
    title,
    locale = "en",
    bandTitle = "Band I",
    chapterTitle = "Kapitel 1",
    phaseHint = null,
    settings,
    storyOrigin = "personal",
    libraryTemplateId = null,
    storyConcept = null,
  } = opts;

  const { data: story, error: storyErr } = await supabase
    .from("stories")
    .insert({
      user_id: userId,
      title: title.trim(),
      locale,
      settings: {
        ...DEFAULT_STORY_SETTINGS,
        ...settings,
        storyOrigin,
        ...(libraryTemplateId ? { libraryTemplateId } : {}),
        ...(storyConcept?.trim() ? { storyConcept: storyConcept.trim() } : {}),
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
      title: bandTitle,
    })
    .select("id")
    .single();
  if (bandErr) throw bandErr;

  const { data: chapter, error: chErr } = await supabase
    .from("chapters")
    .insert({
      band_id: band.id,
      index_in_band: 1,
      title: chapterTitle,
      status: "active",
      phase_hint: phaseHint,
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

export async function findStoryByLibraryTemplate(
  templateId: LibraryTemplateId,
): Promise<{ id: string; title: string } | null> {
  const rows = await listStories(true);
  for (const row of rows) {
    if (getLibraryTemplateId(row.settings) === templateId) {
      return { id: row.id, title: row.title };
    }
  }
  return null;
}

export class DuplicateLibraryImportError extends Error {
  readonly code = "DUPLICATE_LIBRARY_IMPORT" as const;

  constructor(
    readonly existingStoryId: string,
    readonly existingTitle: string,
    readonly templateId: LibraryTemplateId,
  ) {
    super(`Library template "${templateId}" already imported as "${existingTitle}".`);
    this.name = "DuplicateLibraryImportError";
  }
}

export async function importFromLibraryTemplate(
  userId: string,
  templateId: LibraryTemplateId,
): Promise<{ storyId: string; chapterId: string }> {
  const template = getLibraryTemplate(templateId);
  if (!template) throw new Error("Unknown library template");

  const existing = await findStoryByLibraryTemplate(templateId);
  if (existing) {
    throw new DuplicateLibraryImportError(
      existing.id,
      existing.title,
      templateId,
    );
  }

  const pack = template.loadPack();
  return createStoryFromSeedPack({
    userId,
    pack,
    title: template.title,
    locale: template.locale,
    bandTitle: template.bandTitle,
    chapterTitle: template.chapterTitle,
    phaseHint: template.phaseHint ?? null,
    storyOrigin: "library",
    libraryTemplateId: template.id,
    storyConcept: template.defaultConcept,
    settings: {
      voiceMap: defaultElevenVoiceMap(normalizeStoryLocale(template.locale)),
    },
  });
}

/** @deprecated Use importFromLibraryTemplate(userId, "when-dawn-breaks") */
export async function importWhenDawnBreaks(
  userId: string,
  _pack: WryTourSeedPack,
): Promise<{ storyId: string; chapterId: string }> {
  return importFromLibraryTemplate(userId, "when-dawn-breaks");
}

export interface BandRow {
  id: string;
  story_id: string;
  index_in_story: number;
  title: string;
  band_summary: string | null;
}

export type CharacterCastStatus = "active" | "archived";

export interface CharacterRow {
  id: string;
  slug: string;
  role: string;
  name: string;
  card_json: WryTourCharacter;
  created_at?: string;
  status?: CharacterCastStatus;
  character_memory?: string | null;
  archived_at?: string | null;
  archived_reason?: string | null;
  first_seen_chapter_id?: string | null;
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

function mapCharacterRow(c: Record<string, unknown>): CharacterRow {
  return {
    id: c.id as string,
    slug: c.slug as string,
    role: c.role as string,
    name: c.name as string,
    card_json: c.card_json as WryTourCharacter,
    created_at: (c.created_at as string | undefined) ?? undefined,
    status: (c.status as CharacterCastStatus) ?? "active",
    character_memory: (c.character_memory as string | null) ?? null,
    archived_at: (c.archived_at as string | null) ?? null,
    archived_reason: (c.archived_reason as string | null) ?? null,
    first_seen_chapter_id: (c.first_seen_chapter_id as string | null) ?? null,
  };
}

export async function getStoryOverview(storyId: string) {
  const bundle = await getStoryBundle(storyId);
  return {
    ...bundle,
    cast: bundle.allCast,
    storySettings: bundle.storySettings,
  };
}

export async function listCharacters(storyId: string): Promise<CharacterRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("characters")
    .select(
      "id, slug, role, name, card_json, status, character_memory, archived_at, archived_reason, first_seen_chapter_id",
    )
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => mapCharacterRow(c as Record<string, unknown>));
}

export async function applyCharacterMemoryUpdates(
  storyId: string,
  userId: string,
  updates: CharacterMemoryUpdate[],
  chapterId?: string,
): Promise<CharacterRow[]> {
  const supabase = createClient();
  const existing = await listCharacters(storyId);

  for (const u of updates) {
    const row = existing.find(
      (c) => c.role === "cast" && c.slug === u.slug,
    );

    if (u.action === "create" && !row) {
      const { error } = await supabase.from("characters").insert({
        user_id: userId,
        story_id: storyId,
        slug: u.slug,
        role: "cast",
        name: u.name,
        card_json: minimalCharacterCard(u.name),
        character_memory: u.memory,
        status: "active",
        first_seen_chapter_id: chapterId ?? null,
      });
      if (error) throw error;
      continue;
    }

    if (!row || row.role !== "cast") continue;

    const patch: Record<string, unknown> = {
      character_memory: u.memory,
      name: u.name,
    };

    if (u.action === "archive") {
      patch.status = "archived";
      patch.archived_at = new Date().toISOString();
      patch.archived_reason = u.archiveReason?.trim() || "left the story";
    } else {
      patch.status = "active";
      patch.archived_at = null;
      patch.archived_reason = null;
    }

    const { error } = await supabase
      .from("characters")
      .update(patch)
      .eq("id", row.id);
    if (error) throw error;
  }

  await touchStoryUpdated(storyId);
  return listCharacters(storyId);
}

export async function createCastCharacter(
  storyId: string,
  userId: string,
  payload: {
    slug: string;
    name: string;
    card_json?: WryTourCharacter;
    character_memory?: string | null;
    first_seen_chapter_id?: string | null;
  },
): Promise<CharacterRow> {
  const supabase = createClient();
  const slug = payload.slug.trim().toLowerCase().replace(/_/g, "-");
  const name = payload.name.trim() || "Figur";
  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: userId,
      story_id: storyId,
      slug,
      role: "cast",
      name,
      card_json: payload.card_json ?? minimalCharacterCard(name),
      character_memory: payload.character_memory?.trim() || null,
      status: "active",
      first_seen_chapter_id: payload.first_seen_chapter_id ?? null,
    })
    .select(
      "id, slug, role, name, card_json, status, character_memory, archived_at, archived_reason, first_seen_chapter_id",
    )
    .single();
  if (error) throw error;
  await touchStoryUpdated(storyId);
  return mapCharacterRow(data as Record<string, unknown>);
}

export async function updateCharacterManual(
  characterId: string,
  storyId: string,
  patch: {
    character_memory?: string;
    name?: string;
    status?: "active" | "archived";
    archived_reason?: string | null;
  },
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.character_memory !== undefined) {
    row.character_memory = patch.character_memory.trim() || null;
  }
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.status !== undefined) {
    row.status = patch.status;
    if (patch.status === "archived") {
      row.archived_at = new Date().toISOString();
      row.archived_reason = patch.archived_reason?.trim() || "manual";
    } else {
      row.archived_at = null;
      row.archived_reason = null;
    }
  }
  const { error } = await supabase
    .from("characters")
    .update(row)
    .eq("id", characterId)
    .eq("story_id", storyId);
  if (error) throw error;
  await touchStoryUpdated(storyId);
}

export async function updateStoryLorebook(
  lorebookId: string,
  storyId: string,
  book: WryTourLorebook,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lorebooks")
    .update({
      name: book.name.trim() || "World",
      book_json: book,
    })
    .eq("id", lorebookId);
  if (error) throw error;
  await touchStoryUpdated(storyId);
}

export async function updateCharacterCard(
  characterId: string,
  storyId: string,
  card: WryTourCharacter,
): Promise<void> {
  const supabase = createClient();
  const name = card.name?.trim() || "Character";
  const { error } = await supabase
    .from("characters")
    .update({ card_json: card, name })
    .eq("id", characterId)
    .eq("story_id", storyId);
  if (error) throw error;
  await touchStoryUpdated(storyId);
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

  const allCast = ((characters ?? []) as Record<string, unknown>[])
    .filter((c) => c.role === "cast")
    .map((c) => mapCharacterRow(c))
    .sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    );

  const cast = allCast.filter((c) => (c.status ?? "active") === "active");

  return {
    story,
    narrator: narrator.card_json as WryTourCharacter,
    cast,
    allCast,
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
): Promise<TurnRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("turns")
    .insert({
      chapter_id: chapterId,
      index_in_chapter: index,
      role,
      content,
      speaker_slug: speakerSlug ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  if (storyId) await touchStoryUpdated(storyId);
  return data as TurnRow;
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

export async function seedChapterIntro(
  chapterId: string,
  turns: Array<{ content: string; speakerSlug?: string | null }>,
  storyId: string,
): Promise<void> {
  if (!turns.length) return;
  await appendAssistantBlocks(
    chapterId,
    0,
    turns.map((t) => ({
      speakerSlug: t.speakerSlug ?? "narrator",
      content: t.content,
    })),
    storyId,
  );
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

/** Rebuild volume summary from all closed chapter summaries (in order). */
export async function rebuildBandSummary(
  bandId: string,
  chapters: ChapterRow[],
  settings?: import("@/lib/types").OpenRouterSettings | null,
): Promise<void> {
  const { buildBandSummaryForStorage } = await import(
    "@/lib/chapter/bandSummary"
  );
  const text = await buildBandSummaryForStorage(chapters, settings);
  await updateBandSummary(bandId, text);
}

export async function deleteChapter(
  chapterId: string,
  storyId: string,
  bandId: string,
): Promise<{ deletedActive: boolean; newActiveId: string | null }> {
  const supabase = createClient();

  const { data: chapters, error: listErr } = await supabase
    .from("chapters")
    .select("*")
    .eq("band_id", bandId)
    .order("index_in_band");
  if (listErr) throw listErr;
  if (!chapters?.length) throw new Error("Keine Kapitel gefunden.");
  if (chapters.length <= 1) {
    throw new Error("Das letzte Kapitel kann nicht gelöscht werden.");
  }

  const target = chapters.find((c) => c.id === chapterId);
  if (!target) throw new Error("Kapitel nicht gefunden.");

  const turns = await getTurns(chapterId);
  for (const t of turns) {
    if (t.audio_storage_path) {
      await supabase.storage
        .from("tts-audio")
        .remove([t.audio_storage_path]);
    }
  }

  const { error: delErr } = await supabase
    .from("chapters")
    .delete()
    .eq("id", chapterId);
  if (delErr) throw delErr;

  const remaining = chapters.filter((c) => c.id !== chapterId) as ChapterRow[];
  let newActiveId: string | null = null;

  if (target.status === "active") {
    const pick = remaining.reduce((best, c) =>
      c.index_in_band > best.index_in_band ? c : best,
    );
    newActiveId = pick.id as string;
    for (const c of remaining) {
      const nextStatus = c.id === newActiveId ? "active" : "closed";
      if (c.status !== nextStatus) {
        const { error } = await supabase
          .from("chapters")
          .update({ status: nextStatus })
          .eq("id", c.id);
        if (error) throw error;
      }
    }
  }

  await rebuildBandSummary(bandId, remaining);
  await touchStoryUpdated(storyId);

  return {
    deletedActive: target.status === "active",
    newActiveId,
  };
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
