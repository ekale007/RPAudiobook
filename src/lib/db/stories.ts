import { createClient } from "@/lib/supabase/client";
import type { CharacterMemoryUpdate } from "@/lib/memory/characterMemory";
import { minimalCharacterCard } from "@/lib/memory/characterMemory";
import { parsePlotState } from "@/lib/memory/plotState";
import { parseStoryPins } from "@/lib/memory/storyPins";
import {
  DEFAULT_STORY_SETTINGS,
  type QwenVoiceProfile,
  type StoryProtagonistProfile,
  type StorySettings,
  type VoiceMap,
  type StoryCharacterCard,
  type StoryLorebook,
} from "@/lib/types";
import type { StorySeedPack } from "@/lib/import/storySeed";
import type { StoryOrigin } from "@/lib/story/storyOrigin";
import {
  getLibraryTemplate,
  type LibraryTemplateId,
} from "@/lib/story/libraryTemplates";
import { getLibraryTemplateId } from "@/lib/story/storyOrigin";
import { defaultElevenVoiceMap } from "@/lib/tts/elevenLabsVoices";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";
import {
  applyLocalCharacterMemoryUpdates,
  appendLocalAssistantBlocks,
  appendLocalTurn,
  createLocalNextChapter,
  createLocalStoryFromSeedPack,
  deleteLocalStory,
  getLocalStoryBundle,
  getLocalTurns,
  isLocalEntityId,
  isLocalStoryId,
  listLocalStories,
  setLocalStoryArchived,
  shouldStoreStoryLocally,
  touchLocalStoryUpdated,
  updateLocalBandSummary,
  updateLocalChapterSummaries,
  updateLocalChapterTitle,
  updateLocalStoryLocale,
  updateLocalStorySettings,
  updateLocalStoryTitle,
  createLocalCastCharacter,
  listLocalLorebooksForStory,
  updateLocalCharacterCard,
  updateLocalStoryLorebook,
} from "@/lib/db/localStories";
import { isSaasMode } from "@/lib/deploymentMode";

function getCloudSupabase() {
  if (!isSaasMode()) {
    throw new Error("Cloud stories require SaaS deployment (Supabase).");
  }
  return createClient();
}

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
  llm_cost_cents?: number | null;
  tts_cost_cents?: number | null;
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
  const local = await listLocalStories(includeArchived);
  if (!isSaasMode()) return local;
  const supabase = getCloudSupabase();
  const { data, error } = await supabase
    .from("stories")
    .select("id, title, locale, settings, cover_storage_path")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const cloud = (includeArchived
    ? (data ?? [])
    : (data ?? []).filter((r) => !isStoryArchived(r.settings))) as StoryRow[];
  return [...local, ...cloud];
}

export async function setStoryArchived(
  storyId: string,
  archived: boolean,
): Promise<void> {
  if (isLocalStoryId(storyId)) {
    await setLocalStoryArchived(storyId, archived);
    return;
  }
  const supabase = getCloudSupabase();
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
  if (isLocalStoryId(storyId)) {
    await deleteLocalStory(storyId);
    return;
  }
  const supabase = getCloudSupabase();
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
}

export async function updateStoryLocale(
  storyId: string,
  locale: "de" | "en",
): Promise<void> {
  if (isLocalStoryId(storyId)) {
    await updateLocalStoryLocale(storyId, locale);
    return;
  }
  const supabase = getCloudSupabase();
  const { error } = await supabase
    .from("stories")
    .update({ locale, updated_at: new Date().toISOString() })
    .eq("id", storyId);
  if (error) throw error;
}

export async function updateStoryTitle(
  storyId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Story title cannot be empty");
  if (isLocalStoryId(storyId)) {
    await updateLocalStoryTitle(storyId, trimmed);
    return;
  }
  const supabase = getCloudSupabase();
  const { error } = await supabase
    .from("stories")
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq("id", storyId);
  if (error) throw error;
}

export interface CreateStoryFromPackOptions {
  userId: string;
  pack: StorySeedPack;
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
  if (shouldStoreStoryLocally(opts.storyOrigin)) {
    return createLocalStoryFromSeedPack(opts);
  }
  const supabase = getCloudSupabase();
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

/** All stories (incl. archived) imported from this library template. */
export async function listLibraryImportStories(
  templateId: LibraryTemplateId,
): Promise<{ id: string; title: string; archived: boolean }[]> {
  const rows = await listStories(true);
  return rows
    .filter((row) => getLibraryTemplateId(row.settings) === templateId)
    .map((row) => ({
      id: row.id,
      title: row.title,
      archived: isStoryArchived(row.settings),
    }));
}

/** Active (non-archived) story for this library template, if any. */
export async function getActiveLibraryImportStory(
  templateId: LibraryTemplateId,
): Promise<{ id: string; title: string } | null> {
  const rows = await listLibraryImportStories(templateId);
  const hit = rows.find((row) => !row.archived);
  return hit ? { id: hit.id, title: hit.title } : null;
}

/** @deprecated Parallel imports blocked — kept for tests. */
export function nextLibraryImportTitle(
  baseTitle: string,
  existingTitles: string[],
): string {
  const norm = (s: string) => s.trim().toLowerCase();
  const used = new Set(existingTitles.map(norm));
  const base = baseTitle.trim();
  if (!used.has(norm(base))) return base;
  for (let n = 2; n < 500; n++) {
    const candidate = `${base} (${n})`;
    if (!used.has(norm(candidate))) return candidate;
  }
  return `${base} (${Date.now()})`;
}

export type StoryProtagonistImportSetup = {
  protagonist: StoryProtagonistProfile;
  voiceMap: VoiceMap;
  qwenVoiceProfiles?: Record<string, QwenVoiceProfile>;
};

export async function importFromLibraryTemplate(
  userId: string,
  templateId: LibraryTemplateId,
  protagonistSetup?: StoryProtagonistImportSetup,
): Promise<{ storyId: string; chapterId: string }> {
  const template = getLibraryTemplate(templateId);
  if (!template) throw new Error("Unknown library template");

  const siblings = await listLibraryImportStories(templateId);
  const title = nextLibraryImportTitle(
    template.title.trim(),
    siblings.map((s) => s.title),
  );

  const pack = template.loadPack();
  const locale = normalizeStoryLocale(template.locale);
  return createStoryFromSeedPack({
    userId,
    pack,
    title,
    locale: template.locale,
    bandTitle: template.bandTitle,
    chapterTitle: template.chapterTitle,
    phaseHint: template.phaseHint ?? null,
    storyOrigin: "library",
    libraryTemplateId: template.id,
    storyConcept: template.defaultConcept,
    settings: {
      voiceMap:
        protagonistSetup?.voiceMap ??
        defaultElevenVoiceMap(locale),
      ...(protagonistSetup?.protagonist
        ? { protagonist: protagonistSetup.protagonist }
        : {}),
      ...(protagonistSetup?.qwenVoiceProfiles
        ? { qwenVoiceProfiles: protagonistSetup.qwenVoiceProfiles }
        : {}),
    },
  });
}

/** @deprecated Use importFromLibraryTemplate(userId, "when-dawn-breaks") */
export async function importWhenDawnBreaks(
  userId: string,
  _pack: StorySeedPack,
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
  card_json: StoryCharacterCard;
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
  if (isLocalStoryId(storyId)) {
    return updateLocalStorySettings(storyId, patch);
  }
  const supabase = getCloudSupabase();
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
  if (isLocalStoryId(storyId)) {
    await touchLocalStoryUpdated(storyId);
    return;
  }
  const supabase = getCloudSupabase();
  await supabase
    .from("stories")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", storyId);
}

export function mapCharacterRow(c: Record<string, unknown>): CharacterRow {
  return {
    id: c.id as string,
    slug: c.slug as string,
    role: c.role as string,
    name: c.name as string,
    card_json: c.card_json as StoryCharacterCard,
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
  if (isLocalStoryId(storyId)) {
    const { listLocalCharacters } = await import("@/lib/db/localStories");
    return listLocalCharacters(storyId);
  }
  const supabase = getCloudSupabase();
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
  if (isLocalStoryId(storyId)) {
    return applyLocalCharacterMemoryUpdates(
      storyId,
      userId,
      updates,
      chapterId,
    );
  }
  const supabase = getCloudSupabase();
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
    card_json?: StoryCharacterCard;
    character_memory?: string | null;
    first_seen_chapter_id?: string | null;
  },
): Promise<CharacterRow> {
  if (isLocalStoryId(storyId)) {
    return createLocalCastCharacter(storyId, userId, payload);
  }
  const supabase = getCloudSupabase();
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
  const supabase = getCloudSupabase();
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
  book: StoryLorebook,
): Promise<void> {
  if (isLocalStoryId(storyId)) {
    await updateLocalStoryLorebook(lorebookId, storyId, book);
    return;
  }
  const supabase = getCloudSupabase();
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
  card: StoryCharacterCard,
): Promise<void> {
  if (isLocalStoryId(storyId)) {
    await updateLocalCharacterCard(characterId, storyId, card);
    return;
  }
  const supabase = getCloudSupabase();
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
  if (isLocalStoryId(storyId)) {
    return listLocalLorebooksForStory(storyId);
  }
  const supabase = getCloudSupabase();
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
  if (isLocalStoryId(storyId)) {
    return getLocalStoryBundle(storyId, preferredChapterId);
  }
  const supabase = getCloudSupabase();

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
  let lorebooks: Array<{ book_json: StoryLorebook }> = [];
  if (lorebookIds.length) {
    const { data: lbs, error: lbErr } = await supabase
      .from("lorebooks")
      .select("book_json")
      .in("id", lorebookIds);
    if (lbErr) throw lbErr;
    lorebooks = (lbs ?? []) as Array<{ book_json: StoryLorebook }>;
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
    narrator: narrator.card_json as StoryCharacterCard,
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
  if (isLocalEntityId(chapterId)) {
    return getLocalTurns(chapterId);
  }
  const supabase = getCloudSupabase();
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
  costs?: { llmCostCents?: number; ttsCostCents?: number },
): Promise<TurnRow> {
  if (isLocalEntityId(chapterId)) {
    return appendLocalTurn(
      chapterId,
      index,
      role,
      content,
      storyId,
      speakerSlug,
      costs,
    );
  }
  const supabase = getCloudSupabase();
  const row: Record<string, unknown> = {
    chapter_id: chapterId,
    index_in_chapter: index,
    role,
    content,
    speaker_slug: speakerSlug ?? null,
  };
  if (costs?.llmCostCents != null && costs.llmCostCents >= 0) {
    row.llm_cost_cents = costs.llmCostCents;
  }
  if (costs?.ttsCostCents != null && costs.ttsCostCents >= 0) {
    row.tts_cost_cents = costs.ttsCostCents;
  }
  const { data, error } = await supabase
    .from("turns")
    .insert(row)
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
  if (isLocalEntityId(chapterId)) {
    await updateLocalChapterSummaries(chapterId, patch);
    return;
  }
  const supabase = getCloudSupabase();
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
  if (isLocalEntityId(chapterId)) {
    await updateLocalChapterTitle(chapterId, title);
    return;
  }
  const supabase = getCloudSupabase();
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
  if (isLocalEntityId(bandId)) {
    return createLocalNextChapter(bandId, index, title, phaseHint);
  }
  const supabase = getCloudSupabase();
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
  const supabase = getCloudSupabase();

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
  if (isLocalEntityId(bandId)) {
    await updateLocalBandSummary(bandId, summary);
    return;
  }
  const supabase = getCloudSupabase();
  const { error } = await supabase
    .from("bands")
    .update({ band_summary: summary })
    .eq("id", bandId);
  if (error) throw error;
}
