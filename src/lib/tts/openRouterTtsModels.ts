/** OpenRouter speech models — POST /api/v1/audio/speech */

export type OpenRouterTtsModelOption = {
  id: string;
  label: string;
  hint: string;
  defaultVoice: string;
  voices: Array<{ id: string; label: string }>;
};

export const OPENROUTER_TTS_MODEL_OPTIONS: OpenRouterTtsModelOption[] = [
  {
    id: "google/gemini-2.5-flash-preview-tts",
    label: "Gemini 2.5 Flash TTS",
    hint: "~$1/M Zeichen",
    defaultVoice: "Kore",
    voices: [
      { id: "Kore", label: "Kore" },
      { id: "Puck", label: "Puck" },
      { id: "Charon", label: "Charon" },
      { id: "Fenrir", label: "Fenrir" },
      { id: "Aoede", label: "Aoede" },
    ],
  },
  {
    id: "hexgrad/kokoro-82m",
    label: "Kokoro 82M",
    hint: "~$0,62/M Zeichen",
    defaultVoice: "af_bella",
    voices: [
      { id: "af_bella", label: "Bella (EN)" },
      { id: "af_heart", label: "Heart (EN)" },
      { id: "am_adam", label: "Adam (EN)" },
      { id: "bf_emma", label: "Emma (EN)" },
    ],
  },
  {
    id: "mistralai/voxtral-mini-tts-2603",
    label: "Voxtral Mini TTS",
    hint: "~$16/M Zeichen",
    defaultVoice: "alloy",
    voices: [
      { id: "alloy", label: "Alloy" },
      { id: "echo", label: "Echo" },
      { id: "fable", label: "Fable" },
      { id: "onyx", label: "Onyx" },
      { id: "nova", label: "Nova" },
      { id: "shimmer", label: "Shimmer" },
    ],
  },
];

export const DEFAULT_OPENROUTER_TTS_MODEL =
  OPENROUTER_TTS_MODEL_OPTIONS[0]!.id;

export function normalizeOpenRouterTtsModel(model?: string | null): string {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_OPENROUTER_TTS_MODEL;
  const known = OPENROUTER_TTS_MODEL_OPTIONS.find((m) => m.id === trimmed);
  return known?.id ?? trimmed;
}

export function openRouterTtsModelMeta(
  model?: string | null,
): OpenRouterTtsModelOption {
  const id = normalizeOpenRouterTtsModel(model);
  return (
    OPENROUTER_TTS_MODEL_OPTIONS.find((m) => m.id === id) ??
    OPENROUTER_TTS_MODEL_OPTIONS[0]!
  );
}

export function normalizeOpenRouterTtsVoice(
  model: string | undefined | null,
  voice?: string | null,
): string {
  const meta = openRouterTtsModelMeta(model);
  const trimmed = voice?.trim();
  if (!trimmed) return meta.defaultVoice;
  if (meta.voices.some((v) => v.id === trimmed)) return trimmed;
  return trimmed;
}
