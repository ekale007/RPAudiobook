/** Kokoro-82M voices (lang_code=a American English unless noted). */
export type KokoroVoiceMeta = {
  id: string;
  label: string;
  hint: string;
};

export const KOKORO_VOICES: KokoroVoiceMeta[] = [
  { id: "af_heart", label: "Heart", hint: "Warm, expressive" },
  { id: "af_bella", label: "Bella", hint: "Clear narrator" },
  { id: "af_nicole", label: "Nicole", hint: "Soft" },
  { id: "af_sarah", label: "Sarah", hint: "Calm" },
  { id: "af_sky", label: "Sky", hint: "Light" },
  { id: "am_adam", label: "Adam", hint: "Male, neutral" },
  { id: "am_michael", label: "Michael", hint: "Male, deeper" },
  { id: "bf_emma", label: "Emma", hint: "British female" },
  { id: "bf_isabella", label: "Isabella", hint: "British female" },
  { id: "bm_george", label: "George", hint: "British male" },
  { id: "bm_lewis", label: "Lewis", hint: "British male" },
];

export const KOKORO_PREVIEW_TEXT =
  "Hello. I will narrate your story.";
