import {
  getElevenLabsAccountVoices,
  type ElevenCatalogSource,
} from "@/lib/server/elevenLabsAccount";
import type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";
import { getElevenLabsApiKey } from "@/lib/server/env";

export type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";
export type { ElevenCatalogSource } from "@/lib/server/elevenLabsAccount";

/** No server key — UI shows empty list + hint to configure key. */
export function getElevenLabsVoiceCatalogStatic(): ElevenVoiceCatalogEntry[] {
  return [];
}

export type ElevenVoiceCatalogResult = {
  voices: ElevenVoiceCatalogEntry[];
  source: ElevenCatalogSource;
  hint: string;
};

/** My Voices from the ElevenLabs account tied to ELEVENLABS_API_KEY. */
export async function getElevenLabsVoiceCatalog(): Promise<ElevenVoiceCatalogResult> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    return {
      voices: [],
      source: "static-no-key",
      hint: "Kein Server-Key — ELEVENLABS_API_KEY in Vercel oder Key in Settings.",
    };
  }
  const { voices, source } = await getElevenLabsAccountVoices(apiKey);
  if (voices.length === 0) {
    return {
      voices: [],
      source: source === "empty" ? "empty" : source,
      hint:
        "Keine Stimmen unter „My Voices“ im ElevenLabs-Konto. Dort Stimmen hinzufügen (Voice Library → Zu My Voices).",
    };
  }
  return {
    voices,
    source,
    hint: `${voices.length} Stimme(n) aus deinem ElevenLabs-Konto (My Voices).`,
  };
}

export async function getElevenLabsAllowedVoiceIds(): Promise<Set<string>> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) return new Set();
  const { ids } = await getElevenLabsAccountVoices(apiKey);
  return ids;
}
