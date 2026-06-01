import type { VoiceMap } from "@/lib/types";
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
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";
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

export function mergeVoiceMap(
  custom?: VoiceMap | null,
): VoiceMap {
  return { ...DEFAULT_WRYTOUR_VOICE_MAP, ...custom };
}

export function mergeVoiceMapForProvider(
  provider: TtsProvider,
  locale: string | null | undefined,
  custom?: VoiceMap | null,
): VoiceMap {
  if (provider === "elevenlabs") {
    return mergeElevenVoiceMap(normalizeStoryLocale(locale), custom);
  }
  if (provider === "qwen" || provider === "qwen-cloud") {
    return sanitizeVoiceMapForQwen({ ...DEFAULT_QWEN_VOICE_MAP, ...custom });
  }
  return mergeVoiceMap(custom);
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
