import type { VoiceMap } from "@/lib/types";

/** Default Kokoro voices for When Dawn Breaks cast (slug → voice id). */
export const DEFAULT_WRYTOUR_VOICE_MAP: VoiceMap = {
  narrator: "af_heart",
  "naya-vellen": "af_bella",
  "kaelen-vellen": "bm_george",
  lucifer: "am_adam",
  michael: "am_michael",
  gabriel: "bf_emma",
  "maya-roth": "af_sarah",
  "hidden-community": "bf_isabella",
};

export function mergeVoiceMap(
  custom?: VoiceMap | null,
): VoiceMap {
  return { ...DEFAULT_WRYTOUR_VOICE_MAP, ...custom };
}

export function voiceForSpeaker(
  speakerSlug: string | null | undefined,
  voiceMap: VoiceMap,
  fallback: string,
): string {
  const slug = speakerSlug?.trim() || "narrator";
  return voiceMap[slug] ?? voiceMap.narrator ?? fallback;
}
