import type { QwenVoiceProfile, StorySettings } from "@/lib/types";
import { DEFAULT_QWEN_VOICE_MAP } from "@/lib/tts/defaultVoiceMap";
import type { TtsProvider } from "@/lib/storage/ttsSettings";
import { defaultCharacterInstruct } from "@/lib/tts/qwenInstructPresets";
import { resolveStoryDeliveryInstruct } from "@/lib/tts/resolveStoryDelivery";
import type { TtsStoryLocale } from "@/lib/tts/ttsLocaleRouting";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";
import {
  coerceQwenPresetVoice,
  isValidQwenPresetVoice,
} from "@/lib/tts/qwenVoiceSanitize";

export type QwenTtsParams = {
  voice: string;
  language: string;
  instruct: string | null;
};

function qwenLanguageForLocale(locale?: TtsStoryLocale): string {
  return normalizeStoryLocale(locale) === "de" ? "German" : "Auto";
}

export function emptyQwenProfile(slug: string): QwenVoiceProfile {
  const key = slug.trim().toLowerCase() || "narrator";
  return {
    slug: key,
    mode: "preset",
    presetSpeaker:
      DEFAULT_QWEN_VOICE_MAP[key] ?? DEFAULT_QWEN_VOICE_MAP.narrator ?? "Ryan",
    designInstruct: defaultCharacterInstruct(key),
    language: "Auto",
    updatedAt: new Date().toISOString(),
  };
}

/** Merge DB profiles with voiceMap legacy + defaults. */
export function buildQwenProfilesFromSettings(
  settings: StorySettings | null | undefined,
  castSlugs: string[],
): Record<string, QwenVoiceProfile> {
  const out: Record<string, QwenVoiceProfile> = {};
  const slugs = ["narrator", ...castSlugs.filter((s) => s !== "narrator")];
  for (const slug of slugs) {
    const existing = settings?.qwenVoiceProfiles?.[slug];
    const fromMap = settings?.voiceMap?.[slug];
    const base = emptyQwenProfile(slug);
    out[slug] = {
      ...base,
      ...existing,
      slug,
      presetSpeaker: coerceQwenPresetVoice(
        existing?.presetSpeaker?.trim() ||
          (fromMap && isValidQwenPresetVoice(fromMap) ? fromMap : null),
        slug,
      ),
      designInstruct:
        existing?.designInstruct?.trim() ||
        base.designInstruct ||
        defaultCharacterInstruct(slug),
    };
  }
  return out;
}

export function resolveQwenTtsParams(
  speakerSlug: string | null | undefined,
  storySettings: StorySettings | null | undefined,
  storyLocale?: TtsStoryLocale,
  options?: {
    /** Text of the current TTS segment (for language + local scene mood). */
    segmentText?: string;
    provider?: TtsProvider;
  },
): QwenTtsParams {
  const slug = (speakerSlug?.trim() || "narrator").toLowerCase();
  const isNarrator = slug === "narrator";
  const profiles = storySettings?.qwenVoiceProfiles ?? {};
  const profile: QwenVoiceProfile | undefined = profiles[slug] ?? profiles.narrator;

  const fallbackVoice =
    DEFAULT_QWEN_VOICE_MAP[slug] ??
    DEFAULT_QWEN_VOICE_MAP.narrator ??
    "Ryan";

  const fromMap = storySettings?.voiceMap?.[slug]?.trim();
  const voice = coerceQwenPresetVoice(
    profile?.presetSpeaker?.trim() ||
      (fromMap && isValidQwenPresetVoice(fromMap) ? fromMap : null) ||
      fallbackVoice,
    slug,
  );

  const language = resolveQwenLanguage(
    profile?.language,
    storyLocale,
    options?.segmentText,
  );

  const customInstruct = profile?.designInstruct?.trim() || null;
  const isCloud = options?.provider === "qwen-cloud";
  const shortDialogue =
    !isNarrator && (options?.segmentText?.trim().length ?? 0) > 0 &&
    (options?.segmentText?.trim().length ?? 0) < 140;

  let instruct = resolveStoryDeliveryInstruct(
    slug,
    storySettings,
    storyLocale,
    { segmentText: options?.segmentText },
  );
  if (shortDialogue && isCloud && !customInstruct) {
    instruct = null;
  } else if (!isNarrator && !customInstruct) {
    instruct = defaultCharacterInstruct(slug);
  }

  return { voice, language, instruct };
}

function resolveQwenLanguage(
  profileLanguage: string | undefined,
  storyLocale?: TtsStoryLocale,
  segmentText?: string,
): string {
  const profile = profileLanguage?.trim();
  if (profile && profile !== "Auto") return profile;
  const sample = segmentText?.trim().slice(0, 800) ?? "";
  if (sample.length >= 20) {
    const de =
      (sample.match(/\b(und|der|die|das|ist|nicht|sie|ein|ich|mit)\b/gi) ?? [])
        .length;
    const en =
      (sample.match(/\b(the|and|is|her|his|you|with|she|was|for)\b/gi) ?? [])
        .length;
    if (en >= 3 && en > de * 1.2) return "English";
    if (de >= 3 && de > en * 1.2) return "German";
  }
  return qwenLanguageForLocale(storyLocale);
}

export function defaultQwenVoiceMap(
  custom?: Record<string, QwenVoiceProfile> | null,
): Record<string, string> {
  const out: Record<string, string> = { ...DEFAULT_QWEN_VOICE_MAP };
  if (!custom) return out;
  for (const [slug, profile] of Object.entries(custom)) {
    if (profile.presetSpeaker?.trim()) {
      out[slug] = profile.presetSpeaker.trim();
    }
  }
  return out;
}
