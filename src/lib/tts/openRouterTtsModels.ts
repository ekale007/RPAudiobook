/** OpenRouter speech models — POST /api/v1/audio/speech */

export type OpenRouterTtsModelOption = {
  id: string;
  label: string;
  hint: string;
  defaultVoice: string;
  voices: Array<{ id: string; label: string }>;
};

/** Slugs that OpenRouter no longer serves — map to a current default. */
export const DEPRECATED_OPENROUTER_TTS_MODELS: Record<string, string> = {
  "google/gemini-2.5-flash-preview-tts": "hexgrad/kokoro-82m",
};

export const OPENROUTER_TTS_MODEL_OPTIONS: OpenRouterTtsModelOption[] = [
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
      { id: "alloy", label: "Alloy (OpenRouter)" },
    ],
  },
  {
    id: "google/gemini-3.1-flash-tts-preview",
    label: "Gemini 3.1 Flash TTS",
    hint: "~$20/M Audio · Emotion-Tags",
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
  const remapped = DEPRECATED_OPENROUTER_TTS_MODELS[trimmed];
  if (remapped) return remapped;
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
  return meta.defaultVoice;
}

export function parseOpenRouterTtsErrorBody(raw: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === "string") return parsed.error.trim();
    if (parsed.error && typeof parsed.error === "object") {
      return parsed.error.message?.trim() || "";
    }
    return parsed.message?.trim() || trimmed;
  } catch {
    return trimmed.slice(0, 400);
  }
}

export function formatOpenRouterTtsError(
  status: number,
  rawBody?: string,
  model?: string,
): string {
  const detail = parseOpenRouterTtsErrorBody(rawBody ?? "");
  const lower = detail.toLowerCase();

  if (
    status === 400 &&
    (lower.includes("not available") ||
      lower.includes("not found") ||
      lower.includes("no endpoints") ||
      lower.includes("invalid model"))
  ) {
    return (
      `OpenRouter TTS: Modell „${model ?? "?"}“ nicht verfügbar. ` +
      "In Settings ein anderes Modell wählen (z. B. Kokoro 82M)."
    );
  }

  if (status === 400 && lower.includes("voice")) {
    return (
      "OpenRouter TTS: Stimme passt nicht zum Modell — in Settings Erzähler-Stimme neu wählen."
    );
  }

  if (status === 402) {
    return "OpenRouter TTS: Guthaben aufgebraucht — openrouter.ai/settings/credits aufladen.";
  }

  if (detail) return `OpenRouter TTS (${status}): ${detail}`;
  return `OpenRouter TTS fehlgeschlagen (${status}).`;
}
