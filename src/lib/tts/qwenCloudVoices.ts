import { normalizeQwenVoiceId } from "@/lib/tts/qwenVoiceSanitize";

/** Default narrator on DashScope (instruct + flash) — warm male, less sharp than Ethan. */
export const QWEN_CLOUD_DEFAULT_NARRATOR = "Kai";

/**
 * Built-in voices on qwen3-tts-instruct-flash (Alibaba docs).
 * Local CustomVoice names (Ryan, Aiden, …) are not on this model.
 */
export const QWEN_CLOUD_INSTRUCT_VOICES = new Set([
  "Cherry",
  "Serena",
  "Ethan",
  "Chelsie",
  "Momo",
  "Vivian",
  "Moon",
  "Maia",
  "Kai",
  "Nofish",
  "Bella",
  "Mia",
  "Mochi",
  "Bellona",
  "Eldric Sage",
  "Jennifer",
]);

/** Map local Qwen3 CustomVoice presets → DashScope cloud names. */
export const QWEN_LOCAL_TO_CLOUD_VOICE: Record<string, string> = {
  Ryan: "Kai",
  Aiden: "Kai",
  Eric: "Kai",
  Dylan: "Kai",
  Uncle_Fu: "Eldric Sage",
  Ono_Anna: "Mia",
  Sohee: "Serena",
  Serena: "Serena",
  Vivian: "Vivian",
};

export function resolveQwenCloudVoice(
  voice: string,
  useInstructModel: boolean,
): string {
  const normalized = normalizeQwenVoiceId(voice.trim() || QWEN_CLOUD_DEFAULT_NARRATOR);
  const aliased = QWEN_LOCAL_TO_CLOUD_VOICE[normalized] ?? normalized;

  if (useInstructModel) {
    if (QWEN_CLOUD_INSTRUCT_VOICES.has(normalized)) return normalized;
    if (QWEN_CLOUD_INSTRUCT_VOICES.has(aliased)) return aliased;
    return QWEN_CLOUD_DEFAULT_NARRATOR;
  }

  // qwen3-tts-flash: Ryan is listed, but intl accounts often match instruct catalog better via alias.
  if (QWEN_LOCAL_TO_CLOUD_VOICE[normalized]) {
    return QWEN_LOCAL_TO_CLOUD_VOICE[normalized];
  }
  return normalized;
}
