/** Curated ElevenLabs premade voices for RP Audiobook (multilingual_v2). */

import { isValidQwenPresetVoice } from "@/lib/tts/qwenVoiceSanitize";

export type ElevenVoiceMeta = {
  id: string;
  label: string;
  hint: string;
  gender: "female" | "male";
};

export type ElevenVoiceCatalogEntry = ElevenVoiceMeta & {
  previewUrl: string | null;
};

/** Well-known ElevenLabs premade voice IDs (multilingual_v2). */
export const ELEVEN_VOICES: ElevenVoiceMeta[] = [
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    label: "George",
    hint: "Warm, ruhig — Erzähler",
    gender: "male",
  },
  {
    id: "ONwK4e9ZLuI852RL2SWn",
    label: "Daniel",
    hint: "Ruhig, klar — DE/EN",
    gender: "male",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    label: "Adam",
    hint: "Tief, bestimmt",
    gender: "male",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    label: "Liam",
    hint: "Jung, neutral",
    gender: "male",
  },
  {
    id: "bIHbv24MWmeRgasZH58o",
    label: "Will",
    hint: "Freundlich, Erzähler",
    gender: "male",
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    label: "Brian",
    hint: "Tief, dokumentarisch",
    gender: "male",
  },
  {
    id: "IK0Bqj7H8920VOZZAEJc",
    label: "Charlie",
    hint: "Natürlich, locker",
    gender: "male",
  },
  {
    id: "iP95p4xoKVk53GoZ742B",
    label: "Chris",
    hint: "Warm, conversational",
    gender: "male",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Sarah",
    hint: "Klar, ausdrucksstark",
    gender: "female",
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    label: "Alice",
    hint: "Sanft, DE/EN",
    gender: "female",
  },
  {
    id: "XB0fDUnXU5powFXDhCwa",
    label: "Charlotte",
    hint: "Expressiv, emotional",
    gender: "female",
  },
  {
    id: "XrExE9yKIg1Wjla3sB",
    label: "Matilda",
    hint: "Warm, vielseitig",
    gender: "female",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    label: "Jessica",
    hint: "Hell, freundlich",
    gender: "female",
  },
  {
    id: "FGY2WhTYpPnrIDTdsKH5",
    label: "Laura",
    hint: "Ruhig, sachlich",
    gender: "female",
  },
  {
    id: "pFZP5JQG7iQjIQuC4Bku",
    label: "Lily",
    hint: "Leicht, jung",
    gender: "female",
  },
  {
    id: "LcfcDJNUP1GQjkzn1xUU",
    label: "Emily",
    hint: "Sanft, emotional",
    gender: "female",
  },
  {
    id: "pMsXgVXv3BLzUgSXRplE",
    label: "Serena",
    hint: "Ruhig, elegant",
    gender: "female",
  },
  {
    id: "pqHfZKP75CvOlQylNhV4",
    label: "Bill",
    hint: "Reif, Autorität",
    gender: "male",
  },
];

export const ELEVEN_DEFAULT_NARRATOR = "JBFqnCBsd6RMkjVDRZzb";
export const ELEVEN_DEFAULT_MODEL = "eleven_multilingual_v2";

/** Expressive model with inline audio tags — see docs/ELEVENLABS-DELIVERY.md */
export const ELEVEN_V3_MODEL = "eleven_v3";

export function getDefaultElevenLabsModel(): string {
  return ELEVEN_DEFAULT_MODEL;
}

export function getElevenLabsVoiceSettings(locale: "de" | "en") {
  return locale === "de"
    ? {
        stability: 0.5,
        similarity_boost: 0.78,
        style: 0.25,
        use_speaker_boost: true,
      }
    : {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      };
}

export function elevenVoiceLabel(voiceId: string): string {
  const v = ELEVEN_VOICES.find((x) => x.id === voiceId);
  return v ? `${v.label} — ${v.hint}` : voiceId;
}

export function elevenVoiceOptions(): Array<{ id: string; label: string }> {
  return ELEVEN_VOICES.map((v) => ({
    id: v.id,
    label: `${v.label} — ${v.hint}`,
  }));
}

/** Minimal defaults — cast slugs get voices from story map or account repair. */
export function defaultElevenVoiceMap(
  _locale: "de" | "en",
): Record<string, string> {
  return {
    narrator: ELEVEN_DEFAULT_NARRATOR,
    protagonist: ELEVEN_DEFAULT_NARRATOR,
  };
}

const ELEVEN_VOICE_IDS = new Set(ELEVEN_VOICES.map((v) => v.id));

/** True for curated or typical ElevenLabs voice IDs — not Qwen/Kokoro names. */
export function isValidElevenLabsVoiceId(
  voice: string | null | undefined,
): boolean {
  const v = voice?.trim();
  if (!v) return false;
  if (ELEVEN_VOICE_IDS.has(v)) return true;
  if (/^[A-Za-z0-9]{18,}$/.test(v)) return true;
  return false;
}

export function coerceElevenLabsVoiceId(
  voice: string | null | undefined,
  speakerSlug?: string | null,
  locale: "de" | "en" = "en",
  allowedIds?: ReadonlySet<string> | null,
): string {
  const v = voice?.trim();
  if (v && allowedIds?.size) {
    if (allowedIds.has(v)) return v;
  } else if (v && isValidElevenLabsVoiceId(v)) {
    return v;
  }

  const slug = (speakerSlug?.trim() || "narrator").toLowerCase();
  const defaults = defaultElevenVoiceMap(locale);
  const candidates = [
    defaults[slug],
    defaults.protagonist,
    defaults.narrator,
    ELEVEN_DEFAULT_NARRATOR,
  ];
  for (const c of candidates) {
    const id = c?.trim();
    if (!id) continue;
    if (!allowedIds?.size || allowedIds.has(id)) return id;
  }

  if (allowedIds?.size) {
    const first = [...allowedIds][0];
    if (first) return first;
  }

  return ELEVEN_DEFAULT_NARRATOR;
}

/** Map stored voice IDs to voices that exist on the ElevenLabs account. */
export function repairElevenVoiceMap(
  map: Record<string, string>,
  allowedIds: ReadonlySet<string>,
  locale: "de" | "en",
): { map: Record<string, string>; changed: string[] } {
  if (!allowedIds.size) {
    return { map: { ...map }, changed: [] };
  }

  const out = { ...map };
  const changed: string[] = [];

  const fix = (slug: string, raw: string | undefined) => {
    const id = raw?.trim();
    if (!id || allowedIds.has(id)) return;
    const next = coerceElevenLabsVoiceId(id, slug, locale, allowedIds);
    if (next !== id) {
      out[slug] = next;
      changed.push(slug);
    }
  };

  for (const [slug, id] of Object.entries(out)) {
    fix(slug, id);
  }
  if (!out.narrator?.trim() || !allowedIds.has(out.narrator)) {
    fix("narrator", out.narrator);
  }
  if (!out.protagonist?.trim() || !allowedIds.has(out.protagonist)) {
    fix("protagonist", out.protagonist);
  }

  return { map: out, changed };
}

/** Drop Qwen/Kokoro names when building an ElevenLabs voice map. */
export function sanitizeVoiceMapForEleven(
  locale: "de" | "en",
  map: Record<string, string>,
  allowedIds?: ReadonlySet<string> | null,
): Record<string, string> {
  const base = defaultElevenVoiceMap(locale);
  const out: Record<string, string> = { ...base };
  for (const [slug, id] of Object.entries(map)) {
    const trimmed = id?.trim();
    if (!trimmed) continue;
    if (isValidQwenPresetVoice(trimmed) && !isValidElevenLabsVoiceId(trimmed)) {
      continue;
    }
    if (allowedIds?.size) {
      if (allowedIds.has(trimmed)) out[slug] = trimmed;
      continue;
    }
    if (isValidElevenLabsVoiceId(trimmed)) {
      out[slug] = trimmed;
    }
  }
  if (allowedIds?.size) {
    return repairElevenVoiceMap(out, allowedIds, locale).map;
  }
  return out;
}

export function mergeElevenVoiceMap(
  locale: "de" | "en",
  custom?: Record<string, string> | null,
  allowedIds?: ReadonlySet<string> | null,
): Record<string, string> {
  return sanitizeVoiceMapForEleven(locale, custom ?? {}, allowedIds);
}
