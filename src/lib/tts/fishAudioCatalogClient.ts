import { authFetch } from "@/lib/supabase/authFetch";

export type FishVoiceCatalogEntry = {
  id: string;
  label: string;
  hint: string;
  languages?: string[];
  state?: string;
};

export type FishVoiceCatalogLoadResult = {
  voices: FishVoiceCatalogEntry[];
  hint: string;
  source: "my-voices" | "empty" | "static-no-key" | "upstream-error" | "client-error";
};

let cache: FishVoiceCatalogLoadResult | null = null;
let inflight: Promise<FishVoiceCatalogLoadResult> | null = null;

export function clearFishAudioVoiceCatalogCache(): void {
  cache = null;
  inflight = null;
}

export async function loadFishAudioVoiceCatalogDetailed(): Promise<FishVoiceCatalogLoadResult> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = authFetch("/api/tts/fish/voices", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Fish-Stimmenliste ${res.status}`);
      const json = (await res.json()) as Partial<FishVoiceCatalogLoadResult>;
      cache = {
        voices: json.voices ?? [],
        hint: json.hint ?? "Stimmen aus deinem Fish-Audio-Konto.",
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
