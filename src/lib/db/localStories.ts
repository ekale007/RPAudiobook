import type { CharacterMemoryUpdate } from "@/lib/memory/characterMemory";
import { minimalCharacterCard } from "@/lib/memory/characterMemory";
import { parsePlotState } from "@/lib/memory/plotState";
import { parseStoryPins } from "@/lib/memory/storyPins";
import type { StoryOrigin } from "@/lib/story/storyOrigin";
import { isLocalMode } from "@/lib/deploymentMode";
import type {
  StoryCharacterCard,
  StoryLorebook,
  StorySettings,
} from "@/lib/types";
import { DEFAULT_STORY_SETTINGS } from "@/lib/types";
import type { StorySeedPack } from "@/lib/import/storySeed";

export interface LocalCreateStoryFromPackOptions {
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

type CharacterCastStatus = "active" | "archived";

type StoryRow = {
  id: string;
  title: string;
  locale: string;
  settings: Record<string, unknown>;
  cover_storage_path?: string | null;
};

type ChapterRow = {
  id: string;
  band_id: string;
  index_in_band: number;
  title: string;
  status: string;
  chapter_summary: string | null;
  rolling_summary: string | null;
  phase_hint?: string | null;
  /** Phase 7.2: hierarchical chapter chunks. Optional (post-Migration 018). */
  chapter_chunks?: unknown;
};

type TurnRow = {
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
};

type CharacterRow = {
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
};

function parseStorySettings(raw: unknown): StorySettings {
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

function isStoryArchived(settings: unknown): boolean {
  const s = (settings ?? {}) as { archived?: unknown };
  return s.archived === true;
}

function mapCharacterRow(c: Record<string, unknown>): CharacterRow {
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
import {
  isLocalDbAvailable,
  localDbDelete,
  localDbDeleteByIndex,
  localDbGet,
  localDbGetAll,
  localDbGetByIndex,
  localDbPut,
} from "@/lib/db/localStoryDb";
import { isLocalEntityId, isLocalStoryId, newLocalId } from "@/lib/db/localStoryIds";

type LocalStoryRecord = {
  id: string;
  title: string;
  locale: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  cover_storage_path?: string | null;
};

type LocalCharacterRecord = {
  id: string;
  story_id: string;
  slug: string;
  role: string;
  name: string;
  card_json: StoryCharacterCard;
  created_at: string;
  status?: CharacterCastStatus;
  character_memory?: string | null;
  archived_at?: string | null;
  archived_reason?: string | null;
  first_seen_chapter_id?: string | null;
};

type LocalLorebookRecord = {
  id: string;
  story_id: string;
  slug: string;
  name: string;
  book_json: StoryLorebook;
};

type LocalStoryLoreLink = {
  id: string;
  story_id: string;
  lorebook_id: string;
};

type LocalBandRecord = {
  id: string;
  story_id: string;
  index_in_story: number;
  title: string;
  band_summary?: string | null;
  created_at: string;
};

type LocalChapterRecord = ChapterRow & {
  closed_at?: string | null;
  created_at?: string;
};

type LocalTurnRecord = TurnRow;

export function shouldStoreStoryLocally(origin?: StoryOrigin): boolean {
  if (isLocalMode()) return true;
  return origin === "epub" || origin === "editor";
}

export { isLocalStoryId, isLocalEntityId };

function nowIso(): string {
  return new Date().toISOString();
}

function storyRowFromRecord(r: LocalStoryRecord): StoryRow {
  return {
    id: r.id,
    title: r.title,
    locale: r.locale,
    settings: r.settings,
    cover_storage_path: r.cover_storage_path ?? null,
  };
}

export async function listLocalStories(
  includeArchived = false,
): Promise<StoryRow[]> {
  if (!isLocalDbAvailable()) return [];
  const rows = await localDbGetAll<LocalStoryRecord>("stories");
  const filtered = includeArchived
    ? rows
    : rows.filter((r) => !isStoryArchived(r.settings));
  return filtered
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(storyRowFromRecord);
}

export async function createLocalStoryFromSeedPack(
  opts: LocalCreateStoryFromPackOptions,
): Promise<{ storyId: string; chapterId: string }> {
  if (!isLocalDbAvailable()) {
    throw new Error("Lokale Speicherung nicht verfügbar (IndexedDB).");
  }

  const {
    pack,
    title,
    locale = "en",
    bandTitle = "Band I",
    chapterTitle = "Kapitel 1",
    phaseHint = null,
    settings,
    storyOrigin = "editor",
    libraryTemplateId = null,
    storyConcept = null,
  } = opts;

  const narrator = pack.characters.find((c) => c.role === "narrator");
  if (!narrator) throw new Error("Seed pack missing narrator");

  const storyId = newLocalId();
  const bandId = newLocalId();
  const chapterId = newLocalId();
  const ts = nowIso();

  const storySettings = {
    ...DEFAULT_STORY_SETTINGS,
    ...settings,
    storyOrigin,
    storageMode: "local",
    ...(libraryTemplateId ? { libraryTemplateId } : {}),
    ...(storyConcept?.trim() ? { storyConcept: storyConcept.trim() } : {}),
  };

  await localDbPut<LocalStoryRecord>("stories", {
    id: storyId,
    title: title.trim(),
    locale,
    settings: storySettings,
    created_at: ts,
    updated_at: ts,
    cover_storage_path: null,
  });

  for (const { slug, role, card } of pack.characters) {
    await localDbPut<LocalCharacterRecord>("characters", {
      id: newLocalId(),
      story_id: storyId,
      slug,
      role,
      name: card.name,
      card_json: card,
      created_at: ts,
      status: "active",
    });
  }

  for (const { slug, book } of pack.lorebooks) {
    const loreId = newLocalId();
    await localDbPut<LocalLorebookRecord>("lorebooks", {
      id: loreId,
      story_id: storyId,
      slug,
      name: book.name,
      book_json: book,
    });
    await localDbPut<LocalStoryLoreLink>("story_lorebooks", {
      id: `${storyId}::${loreId}`,
      story_id: storyId,
      lorebook_id: loreId,
    });
  }

  await localDbPut<LocalBandRecord>("bands", {
    id: bandId,
    story_id: storyId,
    index_in_story: 1,
    title: bandTitle,
    band_summary: null,
    created_at: ts,
  });

  await localDbPut<LocalChapterRecord>("chapters", {
    id: chapterId,
    band_id: bandId,
    index_in_band: 1,
    title: chapterTitle,
    status: "active",
    chapter_summary: null,
    rolling_summary: null,
    phase_hint: phaseHint,
    created_at: ts,
  });

  const firstMes = narrator.card.first_mes ?? "";
  if (firstMes) {
    await localDbPut<LocalTurnRecord>("turns", {
      id: newLocalId(),
      chapter_id: chapterId,
      index_in_chapter: 0,
      role: "assistant",
      content: firstMes,
      created_at: ts,
      speaker_slug: "narrator",
    });
  }

  return { storyId, chapterId };
}

export async function getLocalStoryBundle(
  storyId: string,
  preferredChapterId?: string,
) {
  const story = await localDbGet<LocalStoryRecord>("stories", storyId);
  if (!story) throw new Error("Lokale Story nicht gefunden.");

  const characters = await localDbGetByIndex<LocalCharacterRecord>(
    "characters",
    "story_id",
    storyId,
  );
  const narrator = characters.find((c) => c.role === "narrator");
  if (!narrator) throw new Error("No narrator on story");

  const links = (await localDbGetAll<LocalStoryLoreLink>("story_lorebooks")).filter(
    (l) => l.story_id === storyId,
  );
  const lorebooks: Array<{ book_json: StoryLorebook }> = [];
  for (const link of links) {
    const lb = await localDbGet<LocalLorebookRecord>("lorebooks", link.lorebook_id);
    if (lb) lorebooks.push({ book_json: lb.book_json });
  }

  const bands = await localDbGetByIndex<LocalBandRecord>("bands", "story_id", storyId);
  const band = bands.sort((a, b) => a.index_in_story - b.index_in_story)[0];
  if (!band) throw new Error("No band on story");

  const chapters = (
    await localDbGetByIndex<LocalChapterRecord>("chapters", "band_id", band.id)
  ).sort((a, b) => a.index_in_band - b.index_in_band);

  const activeChapter =
    (preferredChapterId
      ? chapters.find((c) => c.id === preferredChapterId)
      : undefined) ??
    chapters.find((c) => c.status === "active") ??
    chapters[chapters.length - 1];
  if (!activeChapter) throw new Error("No chapter");

  const allCast = characters
    .filter((c) => c.role === "cast")
    .map((c) => mapCharacterRow(c as unknown as Record<string, unknown>))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

  const cast = allCast.filter((c) => (c.status ?? "active") === "active");

  return {
    story,
    narrator: narrator.card_json,
    cast,
    allCast,
    storySettings: parseStorySettings(story.settings),
    loreEntries: lorebooks.flatMap((lb) => lb.book_json.entries ?? []),
    band,
    chapters,
    activeChapter,
  };
}

export async function getLocalTurns(chapterId: string): Promise<TurnRow[]> {
  const rows = await localDbGetByIndex<LocalTurnRecord>(
    "turns",
    "chapter_id",
    chapterId,
  );
  return rows.sort((a, b) => a.index_in_chapter - b.index_in_chapter);
}

export async function appendLocalTurn(
  chapterId: string,
  index: number,
  role: "user" | "assistant",
  content: string,
  storyId?: string,
  speakerSlug?: string | null,
  costs?: { llmCostCents?: number; ttsCostCents?: number },
): Promise<TurnRow> {
  const row: LocalTurnRecord = {
    id: newLocalId(),
    chapter_id: chapterId,
    index_in_chapter: index,
    role,
    content,
    created_at: nowIso(),
    speaker_slug: speakerSlug ?? null,
    llm_cost_cents: costs?.llmCostCents,
    tts_cost_cents: costs?.ttsCostCents,
  };
  await localDbPut("turns", row);
  if (storyId) await touchLocalStoryUpdated(storyId);
  return row;
}

export async function appendLocalAssistantBlocks(
  chapterId: string,
  startIndex: number,
  blocks: Array<{ speakerSlug: string; content: string }>,
  storyId?: string,
): Promise<void> {
  for (let i = 0; i < blocks.length; i++) {
    await appendLocalTurn(
      chapterId,
      startIndex + i,
      "assistant",
      blocks[i].content,
      undefined,
      blocks[i].speakerSlug,
    );
  }
  if (storyId) await touchLocalStoryUpdated(storyId);
}

export async function touchLocalStoryUpdated(storyId: string): Promise<void> {
  const story = await localDbGet<LocalStoryRecord>("stories", storyId);
  if (!story) return;
  story.updated_at = nowIso();
  await localDbPut("stories", story);
}

export async function updateLocalStorySettings(
  storyId: string,
  patch: Partial<StorySettings>,
): Promise<StorySettings> {
  const story = await localDbGet<LocalStoryRecord>("stories", storyId);
  if (!story) throw new Error("Lokale Story nicht gefunden.");
  const merged = { ...parseStorySettings(story.settings), ...patch };
  story.settings = merged;
  story.updated_at = nowIso();
  await localDbPut("stories", story);
  return merged;
}

export async function updateLocalChapterSummaries(
  chapterId: string,
  patch: {
    rolling_summary?: string;
    chapter_summary?: string;
    status?: string;
    closed_at?: string;
    /** Phase 7.2: hierarchical chapter chunks. */
    chapter_chunks?: unknown;
  },
): Promise<void> {
  const ch = await localDbGet<LocalChapterRecord>("chapters", chapterId);
  if (!ch) throw new Error("Kapitel nicht gefunden.");
  Object.assign(ch, patch);
  await localDbPut("chapters", ch);
}

export async function updateLocalChapterTitle(
  chapterId: string,
  title: string,
): Promise<void> {
  const ch = await localDbGet<LocalChapterRecord>("chapters", chapterId);
  if (!ch) throw new Error("Kapitel nicht gefunden.");
  ch.title = title;
  await localDbPut("chapters", ch);
}

export async function createLocalNextChapter(
  bandId: string,
  index: number,
  title: string,
  phaseHint?: string,
): Promise<ChapterRow> {
  const chapterId = newLocalId();
  const row: LocalChapterRecord = {
    id: chapterId,
    band_id: bandId,
    index_in_band: index,
    title,
    status: "active",
    chapter_summary: null,
    rolling_summary: null,
    phase_hint: phaseHint ?? null,
    created_at: nowIso(),
  };
  await localDbPut("chapters", row);
  return row;
}

export async function updateLocalBandSummary(
  bandId: string,
  summary: string,
): Promise<void> {
  const band = await localDbGet<LocalBandRecord>("bands", bandId);
  if (!band) return;
  band.band_summary = summary;
  await localDbPut("bands", band);
}

export async function listLocalCharacters(
  storyId: string,
): Promise<CharacterRow[]> {
  const rows = await localDbGetByIndex<LocalCharacterRecord>(
    "characters",
    "story_id",
    storyId,
  );
  return rows
    .map((c) => mapCharacterRow(c as unknown as Record<string, unknown>))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}

export async function applyLocalCharacterMemoryUpdates(
  storyId: string,
  _userId: string,
  updates: CharacterMemoryUpdate[],
  chapterId?: string,
): Promise<CharacterRow[]> {
  const existing = await listLocalCharacters(storyId);
  const ts = nowIso();

  for (const u of updates) {
    const row = existing.find((c) => c.role === "cast" && c.slug === u.slug);

    if (u.action === "create" && !row) {
      await localDbPut<LocalCharacterRecord>("characters", {
        id: newLocalId(),
        story_id: storyId,
        slug: u.slug,
        role: "cast",
        name: u.name,
        card_json: minimalCharacterCard(u.name),
        character_memory: u.memory,
        status: "active",
        created_at: ts,
        first_seen_chapter_id: chapterId ?? null,
      });
      continue;
    }

    if (!row || row.role !== "cast") continue;
    const rec = await localDbGet<LocalCharacterRecord>("characters", row.id);
    if (!rec) continue;

    rec.character_memory = u.memory;
    rec.name = u.name;
    if (u.action === "archive") {
      rec.status = "archived";
      rec.archived_at = ts;
      rec.archived_reason = u.archiveReason?.trim() || "left the story";
    } else {
      rec.status = "active";
      rec.archived_at = null;
      rec.archived_reason = null;
    }
    await localDbPut("characters", rec);
  }

  await touchLocalStoryUpdated(storyId);
  return listLocalCharacters(storyId);
}

export async function deleteLocalStory(storyId: string): Promise<void> {
  const bands = await localDbGetByIndex<LocalBandRecord>("bands", "story_id", storyId);
  const chapterIds = new Set<string>();

  for (const band of bands) {
    const chapters = await localDbGetByIndex<LocalChapterRecord>(
      "chapters",
      "band_id",
      band.id,
    );
    for (const ch of chapters) {
      chapterIds.add(ch.id);
      await localDbDeleteByIndex("turns", "chapter_id", ch.id);
      await localDbDelete("chapters", ch.id);
    }
    await localDbDelete("bands", band.id);
  }

  await localDbDeleteByIndex("characters", "story_id", storyId);

  const links = (await localDbGetAll<LocalStoryLoreLink>("story_lorebooks")).filter(
    (l) => l.story_id === storyId,
  );
  for (const link of links) {
    await localDbDelete("lorebooks", link.lorebook_id);
    await localDbDelete("story_lorebooks", link.id);
  }

  await localDbDelete("stories", storyId);
}

export async function setLocalStoryArchived(
  storyId: string,
  archived: boolean,
): Promise<void> {
  const story = await localDbGet<LocalStoryRecord>("stories", storyId);
  if (!story) throw new Error("Lokale Story nicht gefunden.");
  story.settings = {
    ...parseStorySettings(story.settings),
    archived,
  };
  story.updated_at = nowIso();
  await localDbPut("stories", story);
}

export async function updateLocalStoryTitle(
  storyId: string,
  title: string,
): Promise<void> {
  const story = await localDbGet<LocalStoryRecord>("stories", storyId);
  if (!story) throw new Error("Lokale Story nicht gefunden.");
  story.title = title.trim();
  story.updated_at = nowIso();
  await localDbPut("stories", story);
}

export async function updateLocalStoryLocale(
  storyId: string,
  locale: "de" | "en",
): Promise<void> {
  const story = await localDbGet<LocalStoryRecord>("stories", storyId);
  if (!story) throw new Error("Lokale Story nicht gefunden.");
  story.locale = locale;
  story.updated_at = nowIso();
  await localDbPut("stories", story);
}

export async function truncateLocalTurnsFrom(
  chapterId: string,
  fromIndex: number,
  storyId?: string,
): Promise<TurnRow[]> {
  const all = await getLocalTurns(chapterId);
  const victims = all.filter((t) => t.index_in_chapter >= fromIndex);
  for (const t of victims) {
    await localDbDelete("turns", t.id);
  }
  const remaining = all.filter((t) => t.index_in_chapter < fromIndex);
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].index_in_chapter !== i) {
      const rec = await localDbGet<LocalTurnRecord>("turns", remaining[i].id);
      if (rec) {
        rec.index_in_chapter = i;
        await localDbPut("turns", rec);
      }
    }
  }
  if (storyId) await touchLocalStoryUpdated(storyId);
  return getLocalTurns(chapterId);
}

export async function patchLocalTurnCosts(
  turnId: string,
  patch: { llmCostCents?: number; ttsCostCents?: number },
  storyId?: string,
): Promise<void> {
  const row = await localDbGet<LocalTurnRecord>("turns", turnId);
  if (!row) return;
  if (patch.llmCostCents != null && patch.llmCostCents >= 0) {
    row.llm_cost_cents = patch.llmCostCents;
  }
  if (patch.ttsCostCents != null && patch.ttsCostCents >= 0) {
    row.tts_cost_cents = patch.ttsCostCents;
  }
  await localDbPut("turns", row);
  if (storyId) await touchLocalStoryUpdated(storyId);
}

export async function updateLocalTurnContent(
  turnId: string,
  content: string,
  storyId?: string,
): Promise<void> {
  const row = await localDbGet<LocalTurnRecord>("turns", turnId);
  if (!row) return;
  row.content = content;
  row.audio_storage_path = null;
  await localDbPut("turns", row);
  if (storyId) await touchLocalStoryUpdated(storyId);
}

export async function updateLocalCharacterCard(
  characterId: string,
  storyId: string,
  card: StoryCharacterCard,
): Promise<void> {
  const rec = await localDbGet<LocalCharacterRecord>("characters", characterId);
  if (!rec || rec.story_id !== storyId) throw new Error("Figur nicht gefunden.");
  rec.card_json = card;
  rec.name = card.name?.trim() || "Character";
  await localDbPut("characters", rec);
  await touchLocalStoryUpdated(storyId);
}

export async function listLocalLorebooksForStory(storyId: string) {
  const links = (await localDbGetAll<LocalStoryLoreLink>("story_lorebooks")).filter(
    (l) => l.story_id === storyId,
  );
  const out: Array<{ id: string; slug: string; name: string; book_json: StoryLorebook }> =
    [];
  for (const link of links) {
    const lb = await localDbGet<LocalLorebookRecord>("lorebooks", link.lorebook_id);
    if (lb) {
      out.push({
        id: lb.id,
        slug: lb.slug,
        name: lb.name,
        book_json: lb.book_json,
      });
    }
  }
  return out;
}

export async function updateLocalStoryLorebook(
  lorebookId: string,
  storyId: string,
  book: StoryLorebook,
): Promise<void> {
  const lb = await localDbGet<LocalLorebookRecord>("lorebooks", lorebookId);
  if (!lb || lb.story_id !== storyId) throw new Error("Lorebook nicht gefunden.");
  lb.name = book.name.trim() || "World";
  lb.book_json = book;
  await localDbPut("lorebooks", lb);
  await touchLocalStoryUpdated(storyId);
}

export async function createLocalCastCharacter(
  storyId: string,
  _userId: string,
  payload: {
    slug: string;
    name: string;
    card_json?: StoryCharacterCard;
    character_memory?: string | null;
    first_seen_chapter_id?: string | null;
  },
): Promise<CharacterRow> {
  const slug = payload.slug.trim().toLowerCase().replace(/_/g, "-");
  const name = payload.name.trim() || "Figur";
  const rec: LocalCharacterRecord = {
    id: newLocalId(),
    story_id: storyId,
    slug,
    role: "cast",
    name,
    card_json: payload.card_json ?? minimalCharacterCard(name),
    character_memory: payload.character_memory?.trim() || null,
    status: "active",
    created_at: nowIso(),
    first_seen_chapter_id: payload.first_seen_chapter_id ?? null,
  };
  await localDbPut("characters", rec);
  await touchLocalStoryUpdated(storyId);
  return mapCharacterRow(rec as unknown as Record<string, unknown>);
}

export async function localStoryIdForChapter(
  chapterId: string,
): Promise<string | null> {
  const ch = await localDbGet<LocalChapterRecord>("chapters", chapterId);
  if (!ch) return null;
  const band = await localDbGet<LocalBandRecord>("bands", ch.band_id);
  return band?.story_id ?? null;
}
