/** fal.ai TTS model catalog — POST https://fal.run/{endpoint_id} */

import {
  FAL_ELEVEN_V3_VOICES,
  FAL_KOKORO_AMERICAN_VOICES,
  FAL_KOKORO_BRITISH_VOICES,
  FAL_MINIMAX_VOICES,
  falInworldVoiceGroups,
  type FalTtsVoiceEntry,
  type FalTtsVoiceGroup,
} from "@/lib/tts/falTtsVoices";

export type FalTtsTextField = "prompt" | "text";
export type FalTtsVoiceStyle = "voice" | "minimax_voice_id";

export type FalTtsModelOption = {
  id: string;
  label: string;
  hint: string;
  textField: FalTtsTextField;
  voiceStyle: FalTtsVoiceStyle;
  maxChars: number;
  defaultVoice: string;
  voices: FalTtsVoiceEntry[];
  voiceGroups?: FalTtsVoiceGroup[];
};

const INWORLD_GROUPS = falInworldVoiceGroups();
const INWORLD_VOICES = INWORLD_GROUPS.flatMap((g) => g.voices);

export const FAL_TTS_MODEL_OPTIONS: FalTtsModelOption[] = [
  {
    id: "fal-ai/kokoro/american-english",
    label: "Kokoro — US English",
    hint: "~$0,02/M Zeichen · schnell",
    textField: "prompt",
    voiceStyle: "voice",
    maxChars: 2400,
    defaultVoice: "af_bella",
    voices: FAL_KOKORO_AMERICAN_VOICES,
    voiceGroups: [{ group: "US English", voices: FAL_KOKORO_AMERICAN_VOICES }],
  },
  {
    id: "fal-ai/kokoro/british-english",
    label: "Kokoro — British English",
    hint: "~$0,02/M Zeichen",
    textField: "prompt",
    voiceStyle: "voice",
    maxChars: 2400,
    defaultVoice: "bf_emma",
    voices: FAL_KOKORO_BRITISH_VOICES,
    voiceGroups: [{ group: "British English", voices: FAL_KOKORO_BRITISH_VOICES }],
  },
  {
    id: "fal-ai/inworld-tts",
    label: "Inworld TTS 1.5 Max",
    hint: "~$10/M Zeichen · 16 Sprachen",
    textField: "text",
    voiceStyle: "voice",
    maxChars: 2000,
    defaultVoice: "Johanna (de)",
    voices: INWORLD_VOICES,
    voiceGroups: INWORLD_GROUPS,
  },
  {
    id: "fal-ai/elevenlabs/tts/eleven-v3",
    label: "Eleven v3 (via fal)",
    hint: "~$0,10/1k Zeichen",
    textField: "text",
    voiceStyle: "voice",
    maxChars: 2400,
    defaultVoice: "Rachel",
    voices: FAL_ELEVEN_V3_VOICES,
    voiceGroups: [{ group: "Eleven v3", voices: FAL_ELEVEN_V3_VOICES }],
  },
  {
    id: "fal-ai/minimax/speech-02-hd",
    label: "MiniMax Speech 02 HD",
    hint: "~$0,05/1k Zeichen",
    textField: "text",
    voiceStyle: "minimax_voice_id",
    maxChars: 2400,
    defaultVoice: "Wise_Woman",
    voices: FAL_MINIMAX_VOICES,
    voiceGroups: [{ group: "MiniMax", voices: FAL_MINIMAX_VOICES }],
  },
];

export const DEFAULT_FAL_TTS_MODEL = FAL_TTS_MODEL_OPTIONS[0]!.id;

export function normalizeFalTtsModel(model?: string | null): string {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_FAL_TTS_MODEL;
  const known = FAL_TTS_MODEL_OPTIONS.find((m) => m.id === trimmed);
  return known?.id ?? trimmed;
}

export function falTtsModelMeta(model?: string | null): FalTtsModelOption {
  const id = normalizeFalTtsModel(model);
  return (
    FAL_TTS_MODEL_OPTIONS.find((m) => m.id === id) ?? FAL_TTS_MODEL_OPTIONS[0]!
  );
}

export function defaultFalTtsVoice(model?: string | null): string {
  return falTtsModelMeta(model).defaultVoice;
}

export function isKnownFalTtsVoice(
  model: string | undefined | null,
  voice: string,
): boolean {
  const meta = falTtsModelMeta(model);
  return meta.voices.some((v) => v.id === voice);
}

export function normalizeFalTtsVoice(
  model: string | undefined | null,
  voice?: string | null,
): string {
  const trimmed = voice?.trim();
  if (!trimmed) return defaultFalTtsVoice(model);
  if (isKnownFalTtsVoice(model, trimmed)) return trimmed;
  if (trimmed.length >= 2) return trimmed;
  return defaultFalTtsVoice(model);
}

export function falTtsVoiceGroups(model?: string | null): FalTtsVoiceGroup[] {
  const meta = falTtsModelMeta(model);
  if (meta.voiceGroups?.length) return meta.voiceGroups;
  return [{ group: meta.label, voices: meta.voices }];
}

export function falTtsMaxChars(model?: string | null): number {
  return falTtsModelMeta(model).maxChars;
}

/** Build JSON body for fal.run/{modelId}. */
export function buildFalTtsInput(
  model: string,
  text: string,
  voice: string,
): Record<string, unknown> {
  const meta = falTtsModelMeta(model);
  const resolvedVoice = normalizeFalTtsVoice(model, voice);

  if (meta.voiceStyle === "minimax_voice_id") {
    return {
      text,
      voice_setting: { voice_id: resolvedVoice },
    };
  }

  return {
    [meta.textField]: text,
    voice: resolvedVoice,
  };
}

export function formatFalTtsError(status: number, rawBody?: string): string {
  const trimmed = rawBody?.trim() ?? "";
  let detail = trimmed;
  try {
    const parsed = JSON.parse(trimmed) as {
      detail?: string;
      message?: string;
      error?: string;
    };
    detail =
      parsed.detail?.trim() ||
      parsed.message?.trim() ||
      parsed.error?.trim() ||
      trimmed;
  } catch {
    detail = trimmed.slice(0, 400);
  }

  const lower = detail.toLowerCase();
  if (status === 401 || status === 403) {
    return "fal.ai: API-Key ungültig — FAL_API_KEY in Vercel/.env prüfen (fal.ai/dashboard/keys).";
  }
  if (status === 402 || lower.includes("balance") || lower.includes("credit")) {
    return "fal.ai: Kein Guthaben — Wallet aufladen unter fal.ai/dashboard/billing.";
  }
  if (status === 429) {
    return "fal.ai: Rate-Limit — bitte kurz warten und erneut versuchen.";
  }
  if (detail) return `fal.ai (${status}): ${detail}`;
  return `fal.ai TTS fehlgeschlagen (${status}).`;
}
