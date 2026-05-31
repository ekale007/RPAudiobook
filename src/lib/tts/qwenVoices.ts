/** Qwen3-TTS CustomVoice speakers (see docs/QWEN-TTS.md). */
export type QwenVoiceMeta = {
  id: string;
  label: string;
  hint: string;
  language: string;
};

export const QWEN_VOICES: QwenVoiceMeta[] = [
  { id: "Ryan", label: "Ryan", hint: "Dynamic EN narrator", language: "English" },
  { id: "Aiden", label: "Aiden", hint: "Clear American male", language: "English" },
  { id: "Vivian", label: "Vivian", hint: "Bright, expressive", language: "Chinese" },
  { id: "Serena", label: "Serena", hint: "Warm, gentle", language: "Chinese" },
  { id: "Uncle_Fu", label: "Uncle Fu", hint: "Low mellow male", language: "Chinese" },
  { id: "Dylan", label: "Dylan", hint: "Beijing male", language: "Chinese" },
  { id: "Eric", label: "Eric", hint: "Sichuan male", language: "Chinese" },
  { id: "Ono_Anna", label: "Ono Anna", hint: "Playful JP female", language: "Japanese" },
  { id: "Sohee", label: "Sohee", hint: "Warm KR female", language: "Korean" },
];

export const QWEN_PREVIEW_TEXT =
  "Hello. I will narrate your story from here.";

export const QWEN_DEFAULT_NARRATOR = "Ryan";
