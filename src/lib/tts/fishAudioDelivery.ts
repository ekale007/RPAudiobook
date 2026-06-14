import type { StorySettings } from "@/lib/types";
import {
  isStoryDeliveryEnabled,
  resolveStoryDeliveryInstruct,
} from "@/lib/tts/resolveStoryDelivery";
import type { TtsStoryLocale } from "@/lib/tts/ttsLocaleRouting";

/** Map prose instruct → Fish S2-Pro `[bracket]` prefix (one tag max). */
export function instructToFishAudioPrefix(
  instruct: string | null | undefined,
  speakerSlug: string | null | undefined,
): string {
  if (!instruct?.trim()) return "";
  const t = instruct.toLowerCase();
  const isNarrator =
    (speakerSlug?.trim() || "narrator").toLowerCase() === "narrator";

  if (/whisper|intimate|softly|quiet|hush/i.test(t)) return "[whisper] ";
  if (/laugh|playful|amused|comic|grinning|theatrical/i.test(t))
    return "[laughing] ";
  if (/sigh|exhaust|subdued|grief|tired/i.test(t)) return "[sighing] ";
  if (/urgent|tense|danger|kinetic|sharp|suspense/i.test(t)) return "[excited] ";
  if (/warm|tender|hope|gentle|sunlight|kiss|love|smile/i.test(t)) {
    return isNarrator ? "[softly] " : "[warmly] ";
  }
  if (/ominous|dread|uneasy|wary|cautious/i.test(t)) return "[quietly] ";
  if (/expansive|hopeful|horizon/i.test(t)) return "[calm] ";
  if (/angry|furious|rage/i.test(t)) return "[angry] ";
  if (/sad|melancholy|mourning/i.test(t)) return "[sad] ";
  return "";
}

export function resolveFishAudioTtsText(
  text: string,
  speakerSlug: string | null | undefined,
  storySettings: StorySettings | null | undefined,
  storyLocale?: TtsStoryLocale,
  options?: { segmentText?: string },
): string {
  if (!isStoryDeliveryEnabled(storySettings)) return text;

  const instruct = resolveStoryDeliveryInstruct(
    speakerSlug,
    storySettings,
    storyLocale,
    { segmentText: options?.segmentText ?? text },
  );
  const prefix = instructToFishAudioPrefix(instruct, speakerSlug);
  return prefix ? `${prefix}${text}` : text;
}
