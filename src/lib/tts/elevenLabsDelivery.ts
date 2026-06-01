import type { StorySettings } from "@/lib/types";
import {
  isStoryDeliveryEnabled,
  resolveStoryDeliveryInstruct,
} from "@/lib/tts/resolveStoryDelivery";
import type { TtsStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export const ELEVEN_V3_MODEL = "eleven_v3";

export type ElevenVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

export type ElevenTtsExtras = {
  text: string;
  modelId?: string;
  voiceSettings?: ElevenVoiceSettings;
};

export function isElevenV3Model(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  return id === "eleven_v3" || id.includes("eleven_v3");
}

/** Map prose instruct → Eleven v3 audio tag prefix (one tag max). */
export function instructToElevenAudioPrefix(
  instruct: string | null | undefined,
  speakerSlug: string | null | undefined,
): string {
  if (!instruct?.trim()) return "";
  const t = instruct.toLowerCase();
  const isNarrator = (speakerSlug?.trim() || "narrator").toLowerCase() === "narrator";

  if (/whisper|intimate|softly|quiet|hush/i.test(t)) return "[whispers] ";
  if (/laugh|playful|amused|comic|grinning|theatrical/i.test(t)) return "[laughs softly] ";
  if (/sigh|exhaust|subdued|grief|tired/i.test(t)) return "[sighs] ";
  if (/urgent|tense|danger|kinetic|sharp|suspense/i.test(t)) return "[tense] ";
  if (/warm|tender|hope|gentle|sunlight|kiss|love|smile/i.test(t)) {
    return isNarrator ? "[softly] " : "[warmly] ";
  }
  if (/ominous|dread|uneasy|wary|cautious/i.test(t)) return "[quietly] ";
  if (/expansive|hopeful|horizon/i.test(t)) return "[calm] ";
  return "";
}

export function elevenVoiceSettingsFromInstruct(
  base: ElevenVoiceSettings,
  instruct: string | null | undefined,
): ElevenVoiceSettings {
  if (!instruct?.trim()) return base;
  const t = instruct.toLowerCase();
  if (/whisper|intimate|quiet/i.test(t)) {
    return { ...base, stability: 0.38, style: 0.2, similarity_boost: 0.8 };
  }
  if (/urgent|tense|fight|danger/i.test(t)) {
    return { ...base, stability: 0.32, style: 0.55, similarity_boost: 0.72 };
  }
  if (/warm|tender|gentle|playful|laugh/i.test(t)) {
    return { ...base, stability: 0.42, style: 0.45, similarity_boost: 0.78 };
  }
  if (/cinematic|dramatic/i.test(t)) {
    return { ...base, stability: 0.4, style: 0.5, similarity_boost: 0.76 };
  }
  return { ...base, stability: 0.45, style: 0.35 };
}

export function resolveElevenLabsTtsExtras(
  text: string,
  baseModelId: string,
  baseVoiceSettings: ElevenVoiceSettings,
  speakerSlug: string | null | undefined,
  storySettings: StorySettings | null | undefined,
  storyLocale?: TtsStoryLocale,
  options?: { segmentText?: string },
): ElevenTtsExtras {
  const modelId = baseModelId.trim() || ELEVEN_V3_MODEL;
  const useV3 = isElevenV3Model(modelId);
  const deliveryOn = isStoryDeliveryEnabled(storySettings);

  if (!useV3 || !deliveryOn) {
    return { text, modelId: baseModelId, voiceSettings: baseVoiceSettings };
  }

  const instruct = resolveStoryDeliveryInstruct(
    speakerSlug,
    storySettings,
    storyLocale,
    { segmentText: options?.segmentText ?? text },
  );
  const prefix = instructToElevenAudioPrefix(instruct, speakerSlug);
  const voiceSettings = elevenVoiceSettingsFromInstruct(
    baseVoiceSettings,
    instruct,
  );

  return {
    text: prefix ? `${prefix}${text}` : text,
    modelId,
    voiceSettings,
  };
}
