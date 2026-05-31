import {
  ELEVEN_VOICES,
  type ElevenVoiceCatalogEntry,
} from "@/lib/tts/elevenLabsVoices";
import { getElevenLabsApiKey } from "@/lib/server/env";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const CACHE_MS = 6 * 60 * 60 * 1000;

export type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";

let cached: { at: number; voices: ElevenVoiceCatalogEntry[] } | null = null;

async function fetchPreviewMap(apiKey: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const res = await fetch(`${ELEVEN_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) return map;

  const json = (await res.json()) as {
    voices?: Array<{ voice_id?: string; preview_url?: string | null }>;
  };
  for (const v of json.voices ?? []) {
    if (v.voice_id && v.preview_url) {
      map.set(v.voice_id, v.preview_url);
    }
  }
  return map;
}

/** Curated voices + ElevenLabs preview_url (cached, no TTS credits). */
export async function getElevenLabsVoiceCatalog(): Promise<
  ElevenVoiceCatalogEntry[]
> {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.voices;
  }

  const apiKey = getElevenLabsApiKey();
  const previewMap = apiKey ? await fetchPreviewMap(apiKey) : new Map();

  const voices = ELEVEN_VOICES.map((v) => ({
    ...v,
    previewUrl: previewMap.get(v.id) ?? null,
  }));

  cached = { at: Date.now(), voices };
  return voices;
}

export function getElevenLabsVoiceCatalogStatic(): ElevenVoiceCatalogEntry[] {
  return ELEVEN_VOICES.map((v) => ({ ...v, previewUrl: null }));
}
