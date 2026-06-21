import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import type { PronunciationMap } from "@/lib/tts/pronunciation";

import {
  isServerElevenLabsAvailable,
  isServerFalTtsAvailable,
  isServerFishAudioTtsAvailable,
  isServerOpenRouterTtsAvailable,
  isServerQwenCloudTtsAvailable,
  isServerQwenTtsAvailable,
  type ServerCapabilities,
} from "@/lib/server/serverCapabilities";
import {
  DEFAULT_OPENROUTER_TTS_MODEL,
  normalizeOpenRouterTtsModel,
  normalizeOpenRouterTtsVoice,
} from "@/lib/tts/openRouterTtsModels";
import {
  DEFAULT_FISH_AUDIO_MODEL,
  DEFAULT_FISH_AUDIO_REFERENCE_ID,
  looksLikeFishReferenceId,
  normalizeFishAudioModel,
  normalizeFishAudioPinnedIds,
  normalizeFishAudioReferenceId,
} from "@/lib/tts/fishAudioVoices";
import {
  DEFAULT_FAL_TTS_MODEL,
  normalizeFalTtsModel,
  normalizeFalTtsVoice,
} from "@/lib/tts/falTtsModels";
import {
  coerceQwenPresetVoice,
  isValidQwenPresetVoice,
} from "@/lib/tts/qwenVoiceSanitize";
import { coerceElevenLabsVoiceId } from "@/lib/tts/elevenLabsVoices";
import { normalizeElevenLabsModelId } from "@/lib/tts/elevenLabsModels";
import { QWEN_CLOUD_DEFAULT_NARRATOR } from "@/lib/tts/qwenCloudVoices";
import { QWEN_DEFAULT_NARRATOR } from "@/lib/tts/qwenVoices";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";

export type TtsProvider =
  | "local"
  | "elevenlabs"
  | "openrouter-tts"
  | "fish-audio"
  | "fal-ai"
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
  /** Fish Audio API key (browser-only in local deployment). */
  fishAudioApiKey: string;
  /** Manually saved Fish reference_ids (Lesezeichen-IDs aus der App). */
  fishAudioPinnedIds: string[];
  /** fal.ai endpoint id — POST fal.run/{id} */
  falTtsModel: string;
  falTtsVoice: string;
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
  openRouterTtsVoice: "af_bella",
  fishAudioModel: DEFAULT_FISH_AUDIO_MODEL,
  fishAudioReferenceId: DEFAULT_FISH_AUDIO_REFERENCE_ID,
  fishAudioApiKey: "",
  fishAudioPinnedIds: [],
  falTtsModel: DEFAULT_FAL_TTS_MODEL,
  falTtsVoice: "af_bella",
  pronunciationMap: {},
};

/** Beta server UI — cloud TTS providers (Fish first). */
export const BETA_TTS_PROVIDERS: TtsProvider[] = [
  "fish-audio",
  "elevenlabs",
  "openrouter-tts",
  "fal-ai",
];

/** Default cloud TTS on RP Audiobook beta. */
export const DEFAULT_BETA_TTS_PROVIDER: TtsProvider = "fish-audio";

export function isBetaTtsProvider(provider: TtsProvider): boolean {
  return BETA_TTS_PROVIDERS.includes(provider);
}

/** Pick first beta cloud provider that the server actually exposes. */
export function resolveBetaTtsProviderForCapabilities(
  caps: ServerCapabilities,
  preferred: TtsProvider = DEFAULT_BETA_TTS_PROVIDER,
): TtsProvider {
  const candidates = [
    preferred,
    "elevenlabs",
    "openrouter-tts",
    "fal-ai",
    "fish-audio",
  ] as TtsProvider[];
  const seen = new Set<TtsProvider>();
  for (const provider of candidates) {
    if (seen.has(provider)) continue;
    seen.add(provider);
    if (provider === "fish-audio" && caps.serverFishAudioTts) return provider;
    if (provider === "elevenlabs" && caps.serverElevenLabsTts) return provider;
    if (provider === "openrouter-tts" && caps.serverOpenRouterTts) {
      return provider;
    }
    if (provider === "fal-ai" && caps.serverFalTts) return provider;
  }
  return preferred;
}

export function isBetaTtsProviderAvailable(
  provider: TtsProvider,
  caps: ServerCapabilities,
): boolean {
  if (provider === "fish-audio") return caps.serverFishAudioTts;
  if (provider === "elevenlabs") return caps.serverElevenLabsTts;
  if (provider === "openrouter-tts") return caps.serverOpenRouterTts;
  if (provider === "fal-ai") return caps.serverFalTts;
  return false;
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
    out.fishAudioPinnedIds = normalizeFishAudioPinnedIds(out.fishAudioPinnedIds);
  }
  if (out.provider === "fal-ai") {
    out.falTtsModel = normalizeFalTtsModel(out.falTtsModel);
    out.falTtsVoice = normalizeFalTtsVoice(out.falTtsModel, out.falTtsVoice);
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

export function saveFishAudioPinnedIds(ids: string[]): void {
  const tts = loadTtsSettings();
  saveTtsSettings({
    ...tts,
    fishAudioPinnedIds: normalizeFishAudioPinnedIds(ids),
  });
}

export function isTtsReady(settings: TtsSettings): boolean {
  if (settings.provider === "local") return true;
  if (settings.provider === "openrouter-tts") {
    if (isServerOpenRouterTtsAvailable()) return true;
    return Boolean(loadOpenRouterSettings()?.apiKey?.trim());
  }
  if (settings.provider === "fish-audio") {
    const hasKey =
      isServerFishAudioTtsAvailable() ||
      Boolean(settings.fishAudioApiKey?.trim());
    return (
      hasKey && looksLikeFishReferenceId(settings.fishAudioReferenceId)
    );
  }
  if (settings.provider === "fal-ai") {
    return isServerFalTtsAvailable();
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
  if (settings.provider === "fal-ai") {
    return `fal:${settings.falTtsModel}:${settings.falTtsVoice}`;
  }
  const elModel = settings.elevenLabsModelId || "eleven_multilingual_v2";
  const elVer = elModel.includes("v3") ? "v3d" : "v2";
  return `el:${settings.elevenLabsVoiceId}:${elModel}:${elVer}`;
}
