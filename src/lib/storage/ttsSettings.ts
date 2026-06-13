import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { PronunciationMap } from "@/lib/tts/pronunciation";

import {
  isServerElevenLabsAvailable,
  isServerFishAudioTtsAvailable,
  isServerOpenRouterTtsAvailable,
  isServerQwenCloudTtsAvailable,
  isServerQwenTtsAvailable,
} from "@/lib/server/serverCapabilities";
import {
  DEFAULT_FISH_AUDIO_MODEL,
  DEFAULT_FISH_AUDIO_REFERENCE_ID,
  normalizeFishAudioModel,
  normalizeFishAudioReferenceId,
} from "@/lib/tts/fishAudioVoices";
import {
  DEFAULT_OPENROUTER_TTS_MODEL,
  normalizeOpenRouterTtsModel,
  normalizeOpenRouterTtsVoice,
} from "@/lib/tts/openRouterTtsModels";
import {
  coerceQwenPresetVoice,
  isValidQwenPresetVoice,
} from "@/lib/tts/qwenVoiceSanitize";
import { coerceElevenLabsVoiceId } from "@/lib/tts/elevenLabsVoices";
import { normalizeElevenLabsModelId } from "@/lib/tts/elevenLabsModels";
import { QWEN_CLOUD_DEFAULT_NARRATOR } from "@/lib/tts/qwenCloudVoices";
import { QWEN_DEFAULT_NARRATOR } from "@/lib/tts/qwenVoices";

export type TtsProvider =
  | "local"
  | "elevenlabs"
  | "openrouter-tts"
  | "fish-audio"
  | "qwen"
  | "qwen-cloud";

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
  /** OpenRouter speech model — POST /api/v1/audio/speech */
  openRouterTtsModel: string;
  openRouterTtsVoice: string;
  /** Fish Audio model header + reference_id */
  fishAudioModel: string;
  fishAudioReferenceId: string;
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
  openRouterTtsModel: DEFAULT_OPENROUTER_TTS_MODEL,
  openRouterTtsVoice: "Kore",
  fishAudioModel: DEFAULT_FISH_AUDIO_MODEL,
  fishAudioReferenceId: DEFAULT_FISH_AUDIO_REFERENCE_ID,
  pronunciationMap: {},
};

/** Beta server UI — only these three cloud providers. */
export const BETA_TTS_PROVIDERS: TtsProvider[] = [
  "elevenlabs",
  "openrouter-tts",
  "fish-audio",
];

export function isBetaTtsProvider(provider: TtsProvider): boolean {
  return BETA_TTS_PROVIDERS.includes(provider);
}

const STORAGE_KEY = "hoerbuchki.tts";
const TTS_META_KEY = "hoerbuchki.tts.meta";
const LEGACY_ELEVEN_KEY = "hoerbuchki.elevenlabs";

function readTtsUpdatedAt(): string | null {
  try {
    const raw = localStorage.getItem(TTS_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { updatedAt?: string };
    return parsed.updatedAt?.trim() || null;
  } catch {
    return null;
  }
}

function touchTtsUpdatedAt(iso = new Date().toISOString()): string {
  localStorage.setItem(TTS_META_KEY, JSON.stringify({ updatedAt: iso }));
  return iso;
}

export function getTtsSettingsUpdatedAt(): string | null {
  if (typeof window === "undefined") return null;
  return readTtsUpdatedAt();
}

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
    out.elevenLabsModelId = normalizeElevenLabsModelId(out.elevenLabsModelId);
  }
  if (out.provider === "openrouter-tts") {
    out.openRouterTtsModel = normalizeOpenRouterTtsModel(out.openRouterTtsModel);
    out.openRouterTtsVoice = normalizeOpenRouterTtsVoice(
      out.openRouterTtsModel,
      out.openRouterTtsVoice,
    );
  }
  if (out.provider === "fish-audio") {
    out.fishAudioModel = normalizeFishAudioModel(out.fishAudioModel);
    out.fishAudioReferenceId = normalizeFishAudioReferenceId(
      out.fishAudioReferenceId,
    );
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
      if (!readTtsUpdatedAt()) {
        touchTtsUpdatedAt();
      }
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
  options?: { sync?: boolean; updatedAt?: string },
): void {
  const normalized = normalizeTtsSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  localStorage.removeItem(LEGACY_ELEVEN_KEY);
  touchTtsUpdatedAt(options?.updatedAt ?? new Date().toISOString());
  if (options?.sync !== false && typeof window !== "undefined") {
    void import("@/lib/storage/userPreferencesSync").then((m) =>
      m.pushUserPreferencesToAccount(),
    );
  }
}

export function isTtsReady(settings: TtsSettings): boolean {
  if (settings.provider === "local") return true;
  if (settings.provider === "openrouter-tts") {
    return isServerOpenRouterTtsAvailable();
  }
  if (settings.provider === "fish-audio") {
    return (
      isServerFishAudioTtsAvailable() &&
      Boolean(settings.fishAudioReferenceId.trim())
    );
  }
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
  if (settings.provider === "openrouter-tts") {
    return `or-tts:${settings.openRouterTtsModel}:${settings.openRouterTtsVoice}`;
  }
  if (settings.provider === "fish-audio") {
    return `fish:${settings.fishAudioModel}:${settings.fishAudioReferenceId}`;
  }
  const elModel = settings.elevenLabsModelId || "eleven_multilingual_v2";
  const elVer = elModel.includes("v3") ? "v3d" : "v2";
  return `el:${settings.elevenLabsVoiceId}:${elModel}:${elVer}`;
}
