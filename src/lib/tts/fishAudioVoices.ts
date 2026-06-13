/** Fish Audio S2-Pro — POST https://api.fish.audio/v1/tts */

export type FishAudioModel = "s2-pro" | "s1";

export const FISH_AUDIO_MODEL_OPTIONS: Array<{
  id: FishAudioModel;
  label: string;
  hint: string;
}> = [
  {
    id: "s2-pro",
    label: "S2-Pro",
    hint: "~$15/M UTF-8 Bytes · Emotion-Tags [whisper]",
  },
  {
    id: "s1",
    label: "S1",
    hint: "~$15/M · (parenthesis) Emotion-Tags",
  },
];

/** Public example voice from Fish Audio docs — override in Settings. */
export const DEFAULT_FISH_AUDIO_REFERENCE_ID =
  "802e3bc2b27e49c2995d23ef70e6ac89";

export const DEFAULT_FISH_AUDIO_MODEL: FishAudioModel = "s2-pro";

export function normalizeFishAudioModel(model?: string | null): FishAudioModel {
  const trimmed = model?.trim();
  if (trimmed === "s1") return "s1";
  return "s2-pro";
}

export function normalizeFishAudioReferenceId(ref?: string | null): string {
  const trimmed = ref?.trim();
  return trimmed || DEFAULT_FISH_AUDIO_REFERENCE_ID;
}
