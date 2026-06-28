/** Fish Audio — POST https://api.fish.audio/v1/tts
 *  Models: s1 (legacy), s2-pro, s2.1-pro (paid), s2.1-pro-free (free dev tier) */

import type { VoiceMap } from "@/lib/types";

export type FishAudioModel =
  | "s2.1-pro-free"
  | "s2.1-pro"
  | "s2-pro"
  | "s1";

export const FISH_AUDIO_MODEL_OPTIONS: Array<{
  id: FishAudioModel;
  label: string;
  hint: string;
}> = [
  {
    id: "s2.1-pro-free",
    label: "S2.1 Pro (Free)",
    hint: "Kostenlose Dev-Tarif · perfekt zum Testen",
  },
  {
    id: "s2.1-pro",
    label: "S2.1 Pro",
    hint: "Neuestes Modell · $15/1M UTF-8 Bytes",
  },
  {
    id: "s2-pro",
    label: "S2-Pro",
    hint: "Vorherige Generation · $15/1M Bytes · [whisper] Emotion-Tags",
  },
  {
    id: "s1",
    label: "S1",
    hint: "$15/1M · (parenthesis) Emotion-Tags",
  },
];

/** Public example voice from Fish Audio docs — override in Settings. */
export const DEFAULT_FISH_AUDIO_REFERENCE_ID =
  "802e3bc2b27e49c2995d23ef70e6ac89";

/** Default to the free tier so new users can try TTS without paying. */
export const DEFAULT_FISH_AUDIO_MODEL: FishAudioModel = "s2.1-pro-free";

export function normalizeFishAudioModel(model?: string | null): FishAudioModel {
  const trimmed = model?.trim();
  if (
    trimmed === "s1" ||
    trimmed === "s2-pro" ||
    trimmed === "s2.1-pro" ||
    trimmed === "s2.1-pro-free"
  ) {
    return trimmed;
  }
  return DEFAULT_FISH_AUDIO_MODEL;
}

/** Fish model / reference_id (hex, typically 32 chars). */
export function looksLikeFishReferenceId(id?: string | null): boolean {
  const trimmed = id?.trim() ?? "";
  return /^[a-f0-9]{24,64}$/i.test(trimmed);
}

export function normalizeFishAudioReferenceId(ref?: string | null): string {
  const trimmed = ref?.trim();
  if (trimmed && looksLikeFishReferenceId(trimmed)) return trimmed;
  if (trimmed) return trimmed;
  return DEFAULT_FISH_AUDIO_REFERENCE_ID;
}

/** Reject Kokoro/Eleven/fal preset IDs — use narrator fallback for Fish TTS. */
export function coerceFishReferenceId(
  id: string | undefined | null,
  fallback: string,
): string {
  const trimmed = id?.trim();
  if (trimmed && looksLikeFishReferenceId(trimmed)) return trimmed;
  const fb = fallback.trim();
  if (looksLikeFishReferenceId(fb)) return fb;
  return normalizeFishAudioReferenceId(fb);
}

export function sanitizeVoiceMapForFish(
  map: VoiceMap,
  narratorFallback: string,
): VoiceMap {
  const narrator = coerceFishReferenceId(map.narrator, narratorFallback);
  const out: VoiceMap = { narrator };
  for (const [slug, raw] of Object.entries(map)) {
    if (slug === "narrator" || !raw?.trim()) continue;
    if (looksLikeFishReferenceId(raw)) out[slug] = raw.trim();
  }
  return out;
}

export function normalizeFishAudioPinnedIds(ids?: string[] | null): string[] {
  if (!ids?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || !looksLikeFishReferenceId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
