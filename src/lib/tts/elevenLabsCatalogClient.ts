import { authFetch } from "@/lib/supabase/authFetch";
/** Bump with server ELEVEN_CATALOG_REVISION to bust client cache. */
export const ELEVEN_CATALOG_CLIENT_REVISION = 3;

export type ElevenCatalogSource =
  | "my-voices-v2"
  | "my-voices-v1-filter"
  | "empty"
  | "static-no-key"
  | "client-error";
import type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";
import { repairElevenVoiceMap } from "@/lib/tts/elevenLabsVoices";
import type { StoryContentLocale } from "@/lib/story/protagonist";
import type { VoiceMap } from "@/lib/types";

export type ElevenVoiceCatalogLoadResult = {
  voices: ElevenVoiceCatalogEntry[];
  hint: string;
  source: ElevenCatalogSource | "client-error";
};

let cache: ElevenVoiceCatalogLoadResult | null = null;
let inflight: Promise<ElevenVoiceCatalogLoadResult> | null = null;

export function clearElevenLabsVoiceCatalogCache(): void {
  cache = null;
  inflight = null;
}

export async function loadElevenLabsVoiceCatalog(): Promise<
  ElevenVoiceCatalogEntry[]
> {
  const result = await loadElevenLabsVoiceCatalogDetailed();
  return result.voices;
}

export async function loadElevenLabsVoiceCatalogDetailed(): Promise<ElevenVoiceCatalogLoadResult> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = authFetch(
    `/api/tts/voices?rev=${ELEVEN_CATALOG_CLIENT_REVISION}`,
  )
    .then(async (res) => {
      if (!res.ok) throw new Error(`Stimmenliste ${res.status}`);
      const json = (await res.json()) as {
        voices?: ElevenVoiceCatalogEntry[];
        hint?: string;
        source?: ElevenCatalogSource;
      };
      cache = {
        voices: json.voices ?? [],
        hint:
          json.hint ??
          "Stimmen aus deinem ElevenLabs-Konto (My Voices).",
        source: json.source ?? "my-voices-v2",
      };
      return cache;
    })
    .catch((e) => {
      cache = {
        voices: [],
        hint:
          e instanceof Error
            ? e.message
            : "Stimmenliste konnte nicht geladen werden.",
        source: "client-error",
      };
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function elevenVoiceOptionLabel(v: ElevenVoiceCatalogEntry): string {
  return `${v.label} — ${v.hint}`;
}

/** Repair story voiceMap against voices returned from /api/tts/voices. */
export async function repairStoryElevenVoiceMap(
  map: VoiceMap,
  locale: StoryContentLocale,
): Promise<{ map: VoiceMap; changed: string[] }> {
  const catalog = await loadElevenLabsVoiceCatalog();
  const allowed = new Set(catalog.map((v) => v.id));
  if (!allowed.size) return { map: { ...map }, changed: [] };
  return repairElevenVoiceMap(map, allowed, locale);
}
