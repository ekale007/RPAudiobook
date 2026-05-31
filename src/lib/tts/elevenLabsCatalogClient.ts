import { authFetch } from "@/lib/supabase/authFetch";
import type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";
import { ELEVEN_VOICES } from "@/lib/tts/elevenLabsVoices";

let cache: ElevenVoiceCatalogEntry[] | null = null;
let inflight: Promise<ElevenVoiceCatalogEntry[]> | null = null;

function staticCatalog(): ElevenVoiceCatalogEntry[] {
  return ELEVEN_VOICES.map((v) => ({ ...v, previewUrl: null }));
}

export async function loadElevenLabsVoiceCatalog(): Promise<
  ElevenVoiceCatalogEntry[]
> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = authFetch("/api/tts/voices")
    .then(async (res) => {
      if (!res.ok) throw new Error(`Stimmenliste ${res.status}`);
      const json = (await res.json()) as { voices?: ElevenVoiceCatalogEntry[] };
      cache = json.voices?.length ? json.voices : staticCatalog();
      return cache;
    })
    .catch(() => {
      cache = staticCatalog();
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
