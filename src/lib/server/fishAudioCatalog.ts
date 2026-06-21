import { getFishAudioApiKey } from "@/lib/server/env";
import { looksLikeFishReferenceId } from "@/lib/tts/fishAudioVoices";
import {
  buildFishVoiceHint,
  pickFishPreviewUrl,
} from "@/lib/tts/fishAudioVoiceMeta";

export type FishVoiceCatalogEntry = {
  id: string;
  label: string;
  hint: string;
  languages: string[];
  state: string;
  source: "self" | "pinned";
  tags: string[];
  previewUrl: string | null;
};

export type FishVoiceCatalogSource =
  | "my-voices"
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

type FishSampleRow = {
  audio?: string;
  text?: string;
  title?: string;
};

type FishModelRow = {
  _id?: string;
  type?: string;
  title?: string;
  state?: string;
  languages?: string[];
  marked?: boolean;
  tags?: string[];
  samples?: FishSampleRow[];
};

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchOut = await Promise.all(batch.map(fn));
    out.push(...batchOut);
  }
  return out;
}

function mapFishRow(
  row: FishModelRow,
  source: FishVoiceCatalogEntry["source"],
): FishVoiceCatalogEntry | null {
  const id = row._id?.trim();
  if (!id) return null;
  const title = row.title?.trim() || "Unbenannt";
  const langs = (row.languages ?? []).filter(Boolean);
  const state = row.state?.trim() || "unknown";
  const tags = (row.tags ?? []).filter(Boolean);
  return {
    id,
    label: title,
    hint: buildFishVoiceHint({ languages: langs, state, tags }),
    languages: langs,
    state,
    source,
    tags,
    previewUrl: pickFishPreviewUrl(row.samples),
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
    const langs = row.languages ?? [];
    const tags = row.tags ?? [];
    return {
      id,
      label: row.title?.trim() || "Gespeicherte ID",
      hint: buildFishVoiceHint({
        languages: langs,
        state: row.state ?? "unknown",
        tags,
      }),
      languages: langs,
      state: row.state ?? "unknown",
      source,
      tags,
      previewUrl: pickFishPreviewUrl(row.samples),
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
      if (!isTtsRow(row) || row.marked) continue;
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

async function listPinnedVoices(
  apiKey: string,
  pinnedIds: string[],
): Promise<FishVoiceCatalogEntry[]> {
  const ids = [
    ...new Set(
      pinnedIds
        .map((id) => id.trim())
        .filter((id) => looksLikeFishReferenceId(id)),
    ),
  ];
  if (!ids.length) return [];

  const mapped = await mapInBatches(ids, 10, async (id) => {
    const entry = await fetchFishModelById(apiKey, id, "pinned");
    return (
      entry ?? {
        id,
        label: "Gespeicherte ID",
        hint: id.slice(0, 12) + "…",
        languages: [],
        state: "unknown",
        source: "pinned" as const,
        tags: [],
        previewUrl: null,
      }
    );
  });

  return mapped;
}

function mergeVoiceLists(
  pinned: FishVoiceCatalogEntry[],
  self: FishVoiceCatalogEntry[],
): FishVoiceCatalogEntry[] {
  const byId = new Map<string, FishVoiceCatalogEntry>();
  const rank: Record<FishVoiceCatalogEntry["source"], number> = {
    pinned: 2,
    self: 1,
  };
  for (const voice of [...self, ...pinned]) {
    const existing = byId.get(voice.id);
    if (!existing || rank[voice.source] >= rank[existing.source]) {
      byId.set(voice.id, voice);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "de"),
  );
}

/** Saved IDs + own clones — metadata from Fish /model/{id}. */
export async function getFishAudioVoiceCatalog(
  pinnedIds: string[] = [],
  apiKeyOverride?: string | null,
): Promise<FishVoiceCatalogResult> {
  const pinnedKey = pinnedIds.join(",");
  if (
    catalogCache &&
    catalogCache.pinnedKey === pinnedKey &&
    Date.now() - catalogCache.at < CATALOG_CACHE_TTL_MS
  ) {
    return catalogCache.result;
  }

  const apiKey = apiKeyOverride?.trim() || getFishAudioApiKey();
  if (!apiKey) {
    return {
      voices: [],
      source: "static-no-key",
      hint: "Fish API-Key in Einstellungen eintragen (fish.audio → API Keys).",
    };
  }

  try {
    const pinnedVoices = await listPinnedVoices(apiKey, pinnedIds);
    const selfVoices = await listSelfVoices(apiKey);
    const voices = mergeVoiceLists(pinnedVoices, selfVoices);

    if (!voices.length) {
      return {
        voices: [],
        source: "empty",
        hint: "Keine Stimmen — unten Fish-IDs speichern.",
      };
    }

    const pinnedCount = voices.filter((v) => v.source === "pinned").length;
    const selfCount = voices.filter((v) => v.source === "self").length;
    const parts: string[] = [];
    if (pinnedCount) parts.push(`${pinnedCount} gespeichert`);
    if (selfCount) parts.push(`${selfCount} eigene Klone`);

    const result: FishVoiceCatalogResult = {
      voices,
      source: pinnedCount ? "pinned" : "my-voices",
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
