/** ElevenLabs TTS models exposed in Settings (IDs must match Eleven API). */
export type ElevenTtsModelOption = {
  id: string;
  label: string;
  hint: string;
  tier: "budget" | "standard" | "premium";
};

export const ELEVEN_TTS_MODEL_OPTIONS: ElevenTtsModelOption[] = [
  {
    id: "eleven_flash_v2_5",
    label: "Flash v2.5",
    hint: "Am günstigsten — gut zum Testen",
    tier: "budget",
  },
  {
    id: "eleven_turbo_v2_5",
    label: "Turbo v2.5",
    hint: "Schnell, günstiger als Multilingual",
    tier: "budget",
  },
  {
    id: "eleven_multilingual_v2",
    label: "Multilingual v2",
    hint: "Standard für DE/EN Hörbuch",
    tier: "standard",
  },
  {
    id: "eleven_v3",
    label: "Eleven v3",
    hint: "Expressiv + Audio-Tags (teurer)",
    tier: "premium",
  },
];

export function normalizeElevenLabsModelId(
  modelId: string | null | undefined,
): string {
  const id = modelId?.trim();
  if (!id) return "eleven_multilingual_v2";
  if (ELEVEN_TTS_MODEL_OPTIONS.some((m) => m.id === id)) return id;
  if (id.includes("eleven_v3")) return "eleven_v3";
  if (id.includes("multilingual")) return "eleven_multilingual_v2";
  if (id.includes("flash")) return "eleven_flash_v2_5";
  if (id.includes("turbo")) return "eleven_turbo_v2_5";
  return "eleven_multilingual_v2";
}

export function elevenModelLabel(modelId: string): string {
  const m = ELEVEN_TTS_MODEL_OPTIONS.find((x) => x.id === modelId);
  return m ? `${m.label} — ${m.hint}` : modelId;
}
