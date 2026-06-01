import type { StorySettings } from "@/lib/types";
import {
  defaultCharacterInstruct,
  mergeInstructs,
  sceneInstructFromNarrationText,
  sceneInstructFromPlot,
} from "@/lib/tts/qwenInstructPresets";
import type { TtsStoryLocale } from "@/lib/tts/ttsLocaleRouting";

/** Shared delivery / mood instruct (Qwen instruct + Eleven v3 audio tags). */
export function resolveStoryDeliveryInstruct(
  speakerSlug: string | null | undefined,
  storySettings: StorySettings | null | undefined,
  storyLocale?: TtsStoryLocale,
  options?: { segmentText?: string },
): string | null {
  const slug = (speakerSlug?.trim() || "narrator").toLowerCase();
  const isNarrator = slug === "narrator";
  const profiles = storySettings?.qwenVoiceProfiles ?? {};
  const profile = profiles[slug] ?? profiles.narrator;

  const useScene =
    storySettings?.qwenSceneInstructEnabled !== false && isNarrator;
  const sceneFromText = sceneInstructFromNarrationText(options?.segmentText);
  const sceneFromPlot = useScene
    ? sceneInstructFromPlot(storySettings?.plotState ?? null)
    : null;
  const sceneInstruct = sceneFromText ?? sceneFromPlot;

  const customInstruct = profile?.designInstruct?.trim() || null;

  if (isNarrator) {
    return mergeInstructs(customInstruct, sceneInstruct);
  }
  return mergeInstructs(customInstruct || defaultCharacterInstruct(slug));
}

export function isStoryDeliveryEnabled(
  storySettings: StorySettings | null | undefined,
): boolean {
  return storySettings?.qwenSceneInstructEnabled !== false;
}
