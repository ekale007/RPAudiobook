import type { VoiceMap, StorySettings, VoiceMapStorageKey } from "@/lib/types";
import {
  isCastVoiceActive,
  normalizeVoiceSlug,
  type VoiceEnabledSlugs,
} from "@/lib/tts/voiceActivation";
import {
  defaultElevenVoiceMap,
  ELEVEN_DEFAULT_NARRATOR,
  mergeElevenVoiceMap,
} from "@/lib/tts/elevenLabsVoices";
import type { TtsProvider } from "@/lib/storage/ttsSettings";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import {
  DEFAULT_FISH_AUDIO_REFERENCE_ID,
  coerceFishReferenceId,
  normalizeFishAudioReferenceId,
  sanitizeVoiceMapForFish,
} from "@/lib/tts/fishAudioVoices";
import {
  DEFAULT_FAL_TTS_MODEL,
  falTtsModelMeta,
  normalizeFalTtsVoice,
} from "@/lib/tts/falTtsModels";
import {
  DEFAULT_OPENROUTER_TTS_MODEL,
  normalizeOpenRouterTtsVoice,
  openRouterTtsModelMeta,
} from "@/lib/tts/openRouterTtsModels";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";
import { withProtagonistVoice } from "@/lib/story/protagonist";
import { sanitizeVoiceMapForQwen } from "@/lib/tts/qwenVoiceSanitize";

/** Default Kokoro voices for When Dawn Breaks cast (slug → voice id). */
export const DEFAULT_WRYTOUR_VOICE_MAP: VoiceMap = {
  narrator: "af_heart",
  "naya-vellen": "af_bella",
  "kaelen-vellen": "bm_george",
  lucifer: "am_adam",
  michael: "am_michael",
  gabriel: "bf_emma",
  "hidden-community": "bf_isabella",
};

/** Qwen3 CustomVoice defaults for the same cast slugs. */
export const DEFAULT_QWEN_VOICE_MAP: VoiceMap = {
  narrator: "Ryan",
  "naya-vellen": "Serena",
  "kaelen-vellen": "Aiden",
  lucifer: "Eric",
  michael: "Ryan",
  gabriel: "Vivian",
  "hidden-community": "Uncle_Fu",
  "tess-roth": "Vivian",
};

export type VoiceMapMergeOptions = {
  localEngine?: LocalTtsEngine | null;
  falTtsModel?: string | null;
};

export function voiceMapStorageKey(
  provider: TtsProvider,
  localEngine?: LocalTtsEngine | null,
): VoiceMapStorageKey {
  if (provider === "local") {
    return localEngine === "qwen" ? "local-qwen" : "local-kokoro";
  }
  return provider;
}

function sanitizeFalVoiceMap(
  map: VoiceMap,
  falTtsModel?: string | null,
): VoiceMap {
  const model = falTtsModel ?? DEFAULT_FAL_TTS_MODEL;
  const out: VoiceMap = {};
  for (const [slug, voice] of Object.entries(map)) {
    if (!voice?.trim()) continue;
    out[slug] = normalizeFalTtsVoice(model, voice);
  }
  return out;
}

export function mergeVoiceMap(
  custom?: VoiceMap | null,
): VoiceMap {
  return { ...DEFAULT_WRYTOUR_VOICE_MAP, ...custom };
}

export function mergeVoiceMapForProvider(
  provider: TtsProvider,
  locale: string | null | undefined,
  custom?: VoiceMap | null,
  options?: VoiceMapMergeOptions,
): VoiceMap {
  const localEngine = options?.localEngine;
  const falModel = options?.falTtsModel ?? DEFAULT_FAL_TTS_MODEL;
  let map: VoiceMap;

  if (provider === "elevenlabs") {
    map = mergeElevenVoiceMap(normalizeStoryLocale(locale), custom);
  } else if (provider === "qwen" || provider === "qwen-cloud") {
    map = sanitizeVoiceMapForQwen({ ...DEFAULT_QWEN_VOICE_MAP, ...custom });
  } else if (provider === "local" && localEngine === "qwen") {
    map = sanitizeVoiceMapForQwen({ ...DEFAULT_QWEN_VOICE_MAP, ...custom });
  } else if (provider === "openrouter-tts") {
    const narrator = normalizeOpenRouterTtsVoice(
      DEFAULT_OPENROUTER_TTS_MODEL,
      custom?.narrator,
    );
    map = { narrator, ...custom };
  } else if (provider === "fish-audio") {
    const fishCustom: VoiceMap = { ...custom };
    map = sanitizeVoiceMapForFish(
      fishCustom,
      normalizeFishAudioReferenceId(
        custom?.narrator ?? DEFAULT_FISH_AUDIO_REFERENCE_ID,
      ),
    );
  } else if (provider === "fal-ai") {
    const narrator = normalizeFalTtsVoice(falModel, custom?.narrator);
    map = sanitizeFalVoiceMap({ narrator, ...custom }, falModel);
  } else {
    map = mergeVoiceMap(custom);
  }
  return withProtagonistVoice(map);
}

/** Read the cast voice map for the active provider (per-provider storage + legacy fallback). */
export function resolveStoryVoiceMap(
  settings: StorySettings,
  provider: TtsProvider,
  locale: string | null | undefined,
  options?: VoiceMapMergeOptions,
): VoiceMap {
  const key = voiceMapStorageKey(provider, options?.localEngine);
  const fromKey = settings.voiceMaps?.[key];
  const hasVoiceMaps =
    settings.voiceMaps && Object.keys(settings.voiceMaps).length > 0;
  const custom = fromKey ?? (!hasVoiceMaps ? settings.voiceMap : undefined);
  return mergeVoiceMapForProvider(provider, locale, custom, options);
}

/** Normalize a voice map before persisting to story settings (provider-safe IDs only). */
export function voiceMapForStorage(
  provider: TtsProvider,
  locale: string | null | undefined,
  map: VoiceMap,
  options?: VoiceMapMergeOptions,
): VoiceMap {
  return mergeVoiceMapForProvider(provider, locale, map, options);
}

/** Patch story settings with a normalized map for one provider without touching other providers. */
export function patchStoryVoiceMaps(
  settings: StorySettings,
  provider: TtsProvider,
  locale: string | null | undefined,
  map: VoiceMap,
  options?: VoiceMapMergeOptions,
): Pick<StorySettings, "voiceMap" | "voiceMaps"> {
  const key = voiceMapStorageKey(provider, options?.localEngine);
  const normalized = voiceMapForStorage(provider, locale, map, options);
  return {
    voiceMaps: { ...(settings.voiceMaps ?? {}), [key]: normalized },
    voiceMap: normalized,
  };
}

export function defaultNarratorVoiceForProvider(
  provider: TtsProvider,
  locale?: string | null,
): string {
  if (provider === "elevenlabs") {
    return (
      defaultElevenVoiceMap(normalizeStoryLocale(locale)).narrator ??
      ELEVEN_DEFAULT_NARRATOR
    );
  }
  if (provider === "qwen" || provider === "qwen-cloud") {
    return DEFAULT_QWEN_VOICE_MAP.narrator ?? "Ryan";
  }
  if (provider === "openrouter-tts") {
    return openRouterTtsModelMeta(DEFAULT_OPENROUTER_TTS_MODEL).defaultVoice;
  }
  if (provider === "fish-audio") {
    return DEFAULT_FISH_AUDIO_REFERENCE_ID;
  }
  if (provider === "fal-ai") {
    return falTtsModelMeta(DEFAULT_FAL_TTS_MODEL).defaultVoice;
  }
  return DEFAULT_WRYTOUR_VOICE_MAP.narrator ?? "af_heart";
}

export function voiceForSpeaker(
  speakerSlug: string | null | undefined,
  voiceMap: VoiceMap,
  fallback: string,
  voiceEnabledSlugs?: VoiceEnabledSlugs,
): string {
  const slug = (speakerSlug?.trim() || "narrator").toLowerCase();
  if (slug === "narrator") {
    return voiceMap.narrator ?? fallback;
  }
  if (slug === "protagonist") {
    return (
      voiceMap.protagonist?.trim() ||
      voiceMap.narrator?.trim() ||
      fallback
    );
  }

  if (!isCastVoiceActive(slug, voiceEnabledSlugs)) {
    return voiceMap.narrator ?? fallback;
  }

  const byExact = voiceMap[slug];
  if (byExact) return byExact;

  const byAlias = resolveVoiceAlias(slug, voiceMap);
  if (byAlias) return byAlias;

  return fallback;
}

function resolveVoiceAlias(slug: string, voiceMap: VoiceMap): string | null {
  const target = normalizeVoiceSlug(slug);
  if (!target) return null;

  for (const [k, v] of Object.entries(voiceMap)) {
    if (!v) continue;
    if (normalizeVoiceSlug(k) === target) {
      return v;
    }
  }
  return null;
}
