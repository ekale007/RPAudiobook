import { getElevenLabsAccountVoices } from "@/lib/server/elevenLabsAccount";
import {
  ELEVEN_VOICES,
  type ElevenVoiceCatalogEntry,
} from "@/lib/tts/elevenLabsVoices";
import { getElevenLabsApiKey } from "@/lib/server/env";

export type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";

export function getElevenLabsVoiceCatalogStatic(): ElevenVoiceCatalogEntry[] {
  return ELEVEN_VOICES.map((v) => ({ ...v, previewUrl: null }));
}

/** Account voices when server key is set; otherwise static curated list. */
export async function getElevenLabsVoiceCatalog(): Promise<
  ElevenVoiceCatalogEntry[]
> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) return getElevenLabsVoiceCatalogStatic();
  const { voices } = await getElevenLabsAccountVoices(apiKey);
  return voices;
}

export async function getElevenLabsAllowedVoiceIds(): Promise<Set<string>> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) return new Set(ELEVEN_VOICES.map((v) => v.id));
  const { ids } = await getElevenLabsAccountVoices(apiKey);
  return ids;
}
