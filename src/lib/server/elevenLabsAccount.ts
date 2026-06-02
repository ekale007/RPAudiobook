import {
  ELEVEN_VOICES,
  type ElevenVoiceCatalogEntry,
} from "@/lib/tts/elevenLabsVoices";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const CACHE_MS = 15 * 60 * 1000;

type ApiVoice = {
  voice_id?: string;
  name?: string;
  preview_url?: string | null;
  category?: string;
  labels?: Record<string, string | string[] | undefined>;
};

let cached: {
  key: string;
  at: number;
  voices: ElevenVoiceCatalogEntry[];
  ids: Set<string>;
} | null = null;

function labelFromApi(v: ApiVoice): { label: string; hint: string } {
  const curated = ELEVEN_VOICES.find((x) => x.id === v.voice_id);
  if (curated) {
    return { label: curated.label, hint: curated.hint };
  }
  const name = v.name?.trim() || "Stimme";
  const accent = v.labels?.accent;
  const accentStr = Array.isArray(accent)
    ? accent[0]
    : typeof accent === "string"
      ? accent
      : "";
  const hint =
    accentStr?.trim() ||
    v.category?.trim() ||
    (v.voice_id ? `${v.voice_id.slice(0, 10)}…` : "");
  return { label: name, hint };
}

function mapApiVoice(v: ApiVoice): ElevenVoiceCatalogEntry | null {
  const id = v.voice_id?.trim();
  if (!id) return null;
  const { label, hint } = labelFromApi(v);
  const curated = ELEVEN_VOICES.find((x) => x.id === id);
  return {
    id,
    label,
    hint,
    gender: curated?.gender ?? "male",
    previewUrl: v.preview_url ?? null,
  };
}

/** Voices available on the configured ElevenLabs account (server key). */
export async function getElevenLabsAccountVoices(apiKey: string): Promise<{
  voices: ElevenVoiceCatalogEntry[];
  ids: Set<string>;
}> {
  const key = apiKey.trim();
  if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) {
    return { voices: cached.voices, ids: cached.ids };
  }

  const res = await fetch(`${ELEVEN_BASE}/voices`, {
    headers: { "xi-api-key": key },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text?.slice(0, 200) || `ElevenLabs voices ${res.status}`,
    );
  }

  const json = (await res.json()) as { voices?: ApiVoice[] };
  const mapped = (json.voices ?? [])
    .map(mapApiVoice)
    .filter((v): v is ElevenVoiceCatalogEntry => v !== null);

  mapped.sort((a, b) => {
    const aCur = ELEVEN_VOICES.some((x) => x.id === a.id) ? 0 : 1;
    const bCur = ELEVEN_VOICES.some((x) => x.id === b.id) ? 0 : 1;
    if (aCur !== bCur) return aCur - bCur;
    return a.label.localeCompare(b.label, "de");
  });

  const voices =
    mapped.length > 0
      ? mapped
      : ELEVEN_VOICES.map((v) => ({ ...v, previewUrl: null }));

  const ids = new Set(voices.map((v) => v.id));
  cached = { key, at: Date.now(), voices, ids };
  return { voices, ids };
}

export function clearElevenLabsAccountVoiceCache(): void {
  cached = null;
}
