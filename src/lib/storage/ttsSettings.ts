import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { PronunciationMap } from "@/lib/tts/pronunciation";

import {
  isServerElevenLabsAvailable,
  isServerQwenCloudTtsAvailable,
  isServerQwenTtsAvailable,
} from "@/lib/server/serverCapabilities";
import {
  coerceQwenPresetVoice,
  isValidQwenPresetVoice,
} from "@/lib/tts/qwenVoiceSanitize";
import { coerceElevenLabsVoiceId } from "@/lib/tts/elevenLabsVoices";
import { QWEN_CLOUD_DEFAULT_NARRATOR } from "@/lib/tts/qwenCloudVoices";
import { QWEN_DEFAULT_NARRATOR } from "@/lib/tts/qwenVoices";

export type TtsProvider = "local" | "elevenlabs" | "qwen" | "qwen-cloud";

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

export function normalizeTtsSettings(settings: TtsSettings): TtsSettings {
  const out = { ...settings };
  if (out.provider === "elevenlabs") {
    out.elevenLabsVoiceId = coerceElevenLabsVoiceId(out.elevenLabsVoiceId);
  }
  if (
    (out.provider === "qwen" || out.provider === "qwen-cloud") &&
    !isValidQwenPresetVoice(out.localVoice)
  ) {
    out.localVoice =
      out.provider === "qwen-cloud"
        ? QWEN_CLOUD_DEFAULT_NARRATOR
        : QWEN_DEFAULT_NARRATOR;
  }
  if (
    out.provider === "qwen-cloud" &&
    out.localVoice === QWEN_DEFAULT_NARRATOR
  ) {
    out.localVoice = QWEN_CLOUD_DEFAULT_NARRATOR;
  }
  return out;
}

export function loadTtsSettings(): TtsSettings {
  if (typeof window === "undefined") return DEFAULT_TTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Saved settings win — never let legacy override provider
      localStorage.removeItem(LEGACY_ELEVEN_KEY);
      const merged = normalizeTtsSettings({
        ...DEFAULT_TTS,
        ...parseStored(raw),
      });
      return merged;
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
  const normalized = normalizeTtsSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  localStorage.removeItem(LEGACY_ELEVEN_KEY);
  if (options?.sync !== false && typeof window !== "undefined") {
    void import("@/lib/storage/userPreferencesSync").then((m) =>
      m.pushUserPreferencesToAccount(),
    );
  }
}

export function isTtsReady(settings: TtsSettings): boolean {
  if (settings.provider === "local") return true;
  if (settings.provider === "qwen") {
    return isServerQwenTtsAvailable() || settings.localServerUrl.trim().length > 0;
  }
  if (settings.provider === "qwen-cloud") {
    return isServerQwenCloudTtsAvailable();
  }
  if (!settings.elevenLabsVoiceId.trim()) return false;
  if (isServerElevenLabsAvailable()) return true;
  return Boolean(settings.elevenLabsApiKey.trim());
}

export function ttsCacheVoiceKey(settings: TtsSettings): string {
  if (settings.provider === "local") {
    return `local:${settings.localEngine}:${settings.localVoice}`;
  }
  if (settings.provider === "qwen") {
    return `qwen:${settings.localVoice}:v1`;
  }
  if (settings.provider === "qwen-cloud") {
    return `qwen-cloud:${settings.localVoice}:v1`;
  }
  const elModel = settings.elevenLabsModelId || "eleven_multilingual_v2";
  const elVer = elModel.includes("v3") ? "v3d" : "v2";
  return `el:${settings.elevenLabsVoiceId}:${elModel}:${elVer}`;
}
