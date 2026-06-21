import { authFetch } from "@/lib/supabase/authFetch";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";
import {
  isServerFishAudioTtsAvailable,
} from "@/lib/server/serverCapabilities";

export type FishVoiceCatalogEntry = {
  id: string;
  label: string;
  hint: string;
  languages?: string[];
  state?: string;
  source?: "self" | "pinned";
  tags?: string[];
  previewUrl?: string | null;
};

export type FishVoiceCatalogLoadResult = {
  voices: FishVoiceCatalogEntry[];
  hint: string;
  source:
    | "my-voices"
    | "pinned"
    | "empty"
    | "static-no-key"
    | "upstream-error"
    | "client-error";
};

let cacheKey: string | null = null;
let cache: FishVoiceCatalogLoadResult | null = null;
let inflight: Promise<FishVoiceCatalogLoadResult> | null = null;

export function clearFishAudioVoiceCatalogCache(): void {
  cache = null;
  cacheKey = null;
  inflight = null;
}

export async function loadFishAudioVoiceCatalogDetailed(
  pinnedIds: string[] = [],
): Promise<FishVoiceCatalogLoadResult> {
  const key = pinnedIds.join(",");
  if (cache && cacheKey === key) return cache;
  if (inflight && cacheKey === key) return inflight;

  cacheKey = key;
  const pinnedQuery = pinnedIds.length
    ? `?pinned=${encodeURIComponent(pinnedIds.join(","))}`
    : "";

  const headers: Record<string, string> = {};
  if (!isServerFishAudioTtsAvailable()) {
    const fishKey = loadTtsSettings().fishAudioApiKey?.trim();
    if (fishKey) headers.Authorization = `Bearer ${fishKey}`;
  }

  inflight = authFetch(`/api/tts/fish/voices${pinnedQuery}`, {
    cache: "no-store",
    headers,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Fish-Stimmenliste ${res.status}`);
      const json = (await res.json()) as Partial<FishVoiceCatalogLoadResult>;
      cache = {
        voices: json.voices ?? [],
        hint: json.hint ?? `${json.voices?.length ?? 0} Stimmen`,
        source: json.source ?? "my-voices",
      };
      return cache;
    })
    .catch((e) => {
      cache = {
        voices: [],
        hint:
          e instanceof Error
            ? e.message
            : "Fish-Stimmenliste konnte nicht geladen werden.",
        source: "client-error",
      };
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function fishVoiceOptionLabel(v: FishVoiceCatalogEntry): string {
  return `${v.label} — ${v.hint}`;
}

export function fishVoiceGroupLabel(
  source: FishVoiceCatalogEntry["source"],
): string {
  if (source === "pinned") return "Gespeicherte Stimmen";
  if (source === "self") return "Eigene Klone";
  return "Stimmen";
}
