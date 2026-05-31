import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { PronunciationMap } from "@/lib/tts/pronunciation";

import { isServerTtsAvailable } from "@/lib/server/serverCapabilities";

export type TtsProvider = "local" | "elevenlabs";

export interface TtsSettings {
  provider: TtsProvider;
  localEngine: LocalTtsEngine;
  /** Local TTS server (edge-tts, Kokoro, Qwen3 wrapper) */
  localServerUrl: string;
  /** Voice id / name for the local engine */
  localVoice: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId: string;
  /** Optional pronunciation overrides, e.g. "Elias" -> "Eh-LEE-as". */
  pronunciationMap?: PronunciationMap;
}

export const DEFAULT_TTS: TtsSettings = {
  provider: "elevenlabs",
  localEngine: "edge",
  localServerUrl: "http://127.0.0.1:5123",
  localVoice: "en-US-AndrewNeural",
  elevenLabsApiKey: "",
  elevenLabsVoiceId: "JBFqnCBsd6RMkjVDRZzb",
  elevenLabsModelId: "eleven_multilingual_v2",
  pronunciationMap: {},
};

const STORAGE_KEY = "hoerbuchki.tts";
const LEGACY_ELEVEN_KEY = "hoerbuchki.elevenlabs";

function parseStored(raw: string): Partial<TtsSettings> {
  return JSON.parse(raw) as Partial<TtsSettings>;
}

/** One-time import from old ElevenLabs-only storage (only when hoerbuchki.tts is missing). */
function migrateLegacyIfNeeded(): TtsSettings | null {
  try {
    const legacy = localStorage.getItem(LEGACY_ELEVEN_KEY);
    if (!legacy) return null;
    const p = JSON.parse(legacy) as {
      apiKey?: string;
      voiceId?: string;
      modelId?: string;
    };
    return {
      ...DEFAULT_TTS,
      provider: "elevenlabs",
      elevenLabsApiKey: p.apiKey ?? "",
      elevenLabsVoiceId: p.voiceId ?? DEFAULT_TTS.elevenLabsVoiceId,
      elevenLabsModelId: p.modelId ?? DEFAULT_TTS.elevenLabsModelId,
    };
  } catch {
    return null;
  }
}

export function loadTtsSettings(): TtsSettings {
  if (typeof window === "undefined") return DEFAULT_TTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Saved settings win — never let legacy override provider
      localStorage.removeItem(LEGACY_ELEVEN_KEY);
      return { ...DEFAULT_TTS, ...parseStored(raw) };
    }

    const migrated = migrateLegacyIfNeeded();
    if (migrated) {
      saveTtsSettings(migrated);
      return migrated;
    }

    return DEFAULT_TTS;
  } catch {
    return DEFAULT_TTS;
  }
}

export function saveTtsSettings(
  settings: TtsSettings,
  options?: { sync?: boolean },
): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  localStorage.removeItem(LEGACY_ELEVEN_KEY);
  if (options?.sync !== false && typeof window !== "undefined") {
    void import("@/lib/storage/userPreferencesSync").then((m) =>
      m.pushUserPreferencesToAccount(),
    );
  }
}

export function isTtsReady(settings: TtsSettings): boolean {
  if (settings.provider === "local") return true;
  if (!settings.elevenLabsVoiceId.trim()) return false;
  if (isServerTtsAvailable()) return true;
  return Boolean(settings.elevenLabsApiKey.trim());
}

export function ttsCacheVoiceKey(settings: TtsSettings): string {
  if (settings.provider === "local") {
    return `local:${settings.localEngine}:${settings.localVoice}`;
  }
  return `el:${settings.elevenLabsVoiceId}:${settings.elevenLabsModelId}:v2`;
}
