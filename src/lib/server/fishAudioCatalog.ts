import { getFishAudioApiKey } from "@/lib/server/env";

export type FishVoiceCatalogEntry = {
  id: string;
  label: string;
  hint: string;
  languages: string[];
  state: string;
  source: "self" | "bookmark" | "pinned";
};

export type FishVoiceCatalogSource =
  | "my-voices"
  | "bookmarks"
  | "pinned"
  | "empty"
  | "static-no-key"
  | "upstream-error";

export type FishVoiceCatalogResult = {
  voices: FishVoiceCatalogEntry[];
  source: FishVoiceCatalogSource;
  hint: string;
};

const FISH_MODELS_URL = "https://api.fish.audio/model";

const CATALOG_CACHE_TTL_MS = 60_000;
let catalogCache: {
  pinnedKey: string;
  at: number;
  result: FishVoiceCatalogResult;
} | null = null;

type FishModelRow = {
  _id?: string;
  type?: string;
  title?: string;
  state?: string;
  languages?: string[];
  marked?: boolean;
};

function mapFishRow(
  row: FishModelRow,
  source: FishVoiceCatalogEntry["source"],
): FishVoiceCatalogEntry | null {
  const id = row._id?.trim();
  if (!id) return null;
  const title = row.title?.trim() || "Unbenannt";
  const langs = (row.languages ?? []).filter(Boolean);
  const langHint = langs.length ? langs.join(", ") : "Sprache unbekannt";
  const state = row.state?.trim() || "unknown";
  const sourceLabel =
    source === "bookmark"
      ? "Lesezeichen"
      : source === "pinned"
        ? "Gespeichert"
        : "Eigen";
  return {
    id,
    label: title,
    hint: `${sourceLabel} · ${langHint} · ${state}`,
    languages: langs,
    state,
    source,
  };
}

function isTtsRow(row: FishModelRow): boolean {
  return !row.type || row.type === "tts";
}

function isUsableFishRow(row: FishModelRow): boolean {
  if (!isTtsRow(row)) return false;
  const state = row.state?.trim();
  if (row.marked) return state === "trained" || !state;
  return state === "trained";
}

async function fetchFishModelPage(
  apiKey: string,
  params: Record<string, string>,
): Promise<{
  items: FishModelRow[];
  hasMore: boolean;
  error?: string;
}> {
  const url = new URL(FISH_MODELS_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      items: [],
      hasMore: false,
      error: errText?.slice(0, 200) || `Fish API ${res.status}`,
    };
  }

  const json = (await res.json()) as {
    items?: FishModelRow[];
    has_more?: boolean | null;
  };

  return {
    items: json.items ?? [],
    hasMore: Boolean(json.has_more),
  };
}

async function fetchFishModelById(
  apiKey: string,
  id: string,
  source: FishVoiceCatalogEntry["source"],
): Promise<FishVoiceCatalogEntry | null> {
  const res = await fetch(`${FISH_MODELS_URL}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const row = (await res.json()) as FishModelRow;
  if (!isUsableFishRow(row)) {
    return {
      id,
      label: row.title?.trim() || "Gespeicherte ID",
      hint: `${source === "pinned" ? "Gespeichert" : "Lesezeichen"} · manuell`,
      languages: row.languages ?? [],
      state: row.state ?? "unknown",
      source,
    };
  }
  return mapFishRow(row, source);
}

async function listSelfVoices(apiKey: string): Promise<FishVoiceCatalogEntry[]> {
  const voices: FishVoiceCatalogEntry[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const pageResult = await fetchFishModelPage(apiKey, {
      self: "true",
      page_size: "50",
      page_number: String(page),
    });
    if (pageResult.error) break;

    for (const row of pageResult.items) {
      if (!isUsableFishRow(row)) continue;
      const mapped = mapFishRow(row, "self");
      if (mapped) voices.push(mapped);
    }

    hasMore = pageResult.hasMore;
    page += 1;
    if (!pageResult.items.length) break;
  }

  return voices;
}

/** Paginate public library and collect marked=true (Fish Lesezeichen). */
async function listBookmarkVoices(
  apiKey: string,
): Promise<FishVoiceCatalogEntry[]> {
  const voices: FishVoiceCatalogEntry[] = [];
  const seen = new Set<string>();
  let page = 1;
  let hasMore = true;
  let emptyMarkedStreak = 0;

  while (hasMore && page <= 40) {
    const pageResult = await fetchFishModelPage(apiKey, {
      page_size: "50",
      page_number: String(page),
      sort_by: "created_at",
    });
    if (pageResult.error) break;

    let markedOnPage = 0;
    for (const row of pageResult.items) {
      if (!row.marked || !isUsableFishRow(row)) continue;
      const mapped = mapFishRow(row, "bookmark");
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      voices.push(mapped);
      markedOnPage += 1;
    }

    emptyMarkedStreak = markedOnPage === 0 ? emptyMarkedStreak + 1 : 0;
    if (voices.length > 0 && emptyMarkedStreak >= 8) break;

    hasMore = pageResult.hasMore;
    page += 1;
    if (!pageResult.items.length) break;
  }

  return voices;
}

async function listPinnedVoices(
  apiKey: string,
  pinnedIds: string[],
): Promise<FishVoiceCatalogEntry[]> {
  const voices: FishVoiceCatalogEntry[] = [];
  for (const rawId of pinnedIds) {
    const id = rawId.trim();
    if (!id || id.length < 8) continue;
    const mapped = await fetchFishModelById(apiKey, id, "pinned");
    voices.push(
      mapped ?? {
        id,
        label: "Gespeicherte ID",
        hint: `Gespeichert · ${id.slice(0, 12)}…`,
        languages: [],
        state: "unknown",
        source: "pinned",
      },
    );
  }
  return voices;
}

function mergeVoiceLists(
  pinned: FishVoiceCatalogEntry[],
  bookmarks: FishVoiceCatalogEntry[],
  self: FishVoiceCatalogEntry[],
): FishVoiceCatalogEntry[] {
  const byId = new Map<string, FishVoiceCatalogEntry>();
  const rank: Record<FishVoiceCatalogEntry["source"], number> = {
    pinned: 3,
    bookmark: 2,
    self: 1,
  };
  for (const voice of [...self, ...bookmarks, ...pinned]) {
    const existing = byId.get(voice.id);
    if (
      !existing ||
      rank[voice.source] >= rank[existing.source]
    ) {
      byId.set(voice.id, voice);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "de"),
  );
}

/** Voices from account clones, Fish Lesezeichen (marked), and locally pinned IDs. */
export async function getFishAudioVoiceCatalog(
  pinnedIds: string[] = [],
): Promise<FishVoiceCatalogResult> {
  const pinnedKey = pinnedIds.join(",");
  if (
    catalogCache &&
    catalogCache.pinnedKey === pinnedKey &&
    Date.now() - catalogCache.at < CATALOG_CACHE_TTL_MS
  ) {
    return catalogCache.result;
  }

  const apiKey = getFishAudioApiKey();
  if (!apiKey) {
    return {
      voices: [],
      source: "static-no-key",
      hint: "Kein Server-Key — FISH_AUDIO_API_KEY in Vercel setzen.",
    };
  }

  try {
    const selfVoices = await listSelfVoices(apiKey);
    const bookmarkVoices = await listBookmarkVoices(apiKey);
    const pinnedVoices = await listPinnedVoices(apiKey, pinnedIds);
    const voices = mergeVoiceLists(pinnedVoices, bookmarkVoices, selfVoices);

    if (!voices.length) {
      return {
        voices: [],
        source: "empty",
        hint:
          "Keine Fish-Stimmen gefunden. Lesezeichen auf fish.audio/de/app/bookmarks/ anlegen oder unten IDs speichern.",
      };
    }

    const bookmarkCount = voices.filter((v) => v.source === "bookmark").length;
    const selfCount = voices.filter((v) => v.source === "self").length;
    const pinnedCount = voices.filter((v) => v.source === "pinned").length;
    const parts: string[] = [];
    if (bookmarkCount) parts.push(`${bookmarkCount} Lesezeichen`);
    if (selfCount) parts.push(`${selfCount} eigene Klone`);
    if (pinnedCount) parts.push(`${pinnedCount} gespeicherte IDs`);

    const result: FishVoiceCatalogResult = {
      voices,
      source: bookmarkCount ? "bookmarks" : selfCount ? "my-voices" : "pinned",
      hint: parts.join(" · ") || `${voices.length} Stimme(n)`,
    };

    catalogCache = { pinnedKey, at: Date.now(), result };
    return result;
  } catch (e) {
    return {
      voices: [],
      source: "upstream-error",
      hint: e instanceof Error ? e.message : "Fish-Stimmenliste fehlgeschlagen.",
    };
  }
}

export function invalidateFishAudioVoiceCatalogCache(): void {
  catalogCache = null;
}
