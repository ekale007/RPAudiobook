import { DEFAULT_QWEN_VOICE_MAP } from "@/lib/tts/defaultVoiceMap";
import { QWEN_VOICES } from "@/lib/tts/qwenVoices";

/** Built-in Qwen / DashScope preset names (local + cloud). */
export const QWEN_PRESET_VOICE_IDS = new Set(
  [
    ...QWEN_VOICES.map((v) => v.id),
    "Cherry",
    "Ethan",
    "Chelsie",
    "Momo",
    "Moon",
    "Maia",
    "Kai",
    "Nofish",
    "Bella",
    "Jennifer",
    "Narrator",
  ].map((id) => id.trim()),
);

/** Opaque provider ids (ElevenLabs, etc.) — not Qwen preset names. */
export function isValidQwenPresetVoice(voice: string | null | undefined): boolean {
  const v = voice?.trim();
  if (!v) return false;
  if (QWEN_PRESET_VOICE_IDS.has(v)) return true;
  if (v.length > 40) return false;
  if (/^(af|am|bf|bm|ef|em|ff|hf|hm|if|im|jf|jm|zf|zm)_/i.test(v)) return false;
  if (/^[A-Za-z0-9]{16,}$/.test(v) && !v.includes("_")) return false;
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(v);
}

export function coerceQwenPresetVoice(
  voice: string | null | undefined,
  speakerSlug?: string | null,
): string {
  const trimmed = voice?.trim();
  if (trimmed && isValidQwenPresetVoice(trimmed)) {
    return normalizeQwenVoiceId(trimmed);
  }
  const slug = (speakerSlug?.trim() || "narrator").toLowerCase();
  const fromDefault =
    DEFAULT_QWEN_VOICE_MAP[slug] ??
    DEFAULT_QWEN_VOICE_MAP.narrator ??
    "Ryan";
  return normalizeQwenVoiceId(fromDefault);
}

export function normalizeQwenVoiceId(voice: string): string {
  const v = voice.trim();
  if (!v) return "Ryan";
  if (v.includes("_")) {
    return v
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("_");
  }
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** Drop ElevenLabs/Kokoro ids when building a Qwen voice map. */
export function sanitizeVoiceMapForQwen(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...DEFAULT_QWEN_VOICE_MAP };
  for (const [slug, id] of Object.entries(map)) {
    if (!id?.trim()) continue;
    if (isValidQwenPresetVoice(id)) {
      out[slug] = normalizeQwenVoiceId(id);
    }
  }
  return out;
}
