import {
  ELEVEN_VOICES,
  type ElevenVoiceCatalogEntry,
} from "@/lib/tts/elevenLabsVoices";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const CACHE_MS = 5 * 60 * 1000;

/** Bump when catalog logic changes (clients may cache /api/tts/voices). */
export const ELEVEN_CATALOG_REVISION = 3;

export type ElevenCatalogSource =
  | "my-voices-v2"
  | "my-voices-v1-filter"
  | "empty"
  | "static-no-key";

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
  source: ElevenCatalogSource;
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
  const cat = v.category?.trim();
  const catHint =
    cat === "cloned"
      ? "Klon"
      : cat === "generated"
        ? "Voice Design"
        : cat === "professional"
          ? "Profi-Klon"
          : cat && cat !== "premade"
            ? cat
            : "";
  const hint =
    accentStr?.trim() ||
    catHint ||
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

function dedupeVoices(
  entries: ElevenVoiceCatalogEntry[],
): ElevenVoiceCatalogEntry[] {
  const seen = new Set<string>();
  const out: ElevenVoiceCatalogEntry[] = [];
  for (const v of entries) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "de"));
  return out;
}

function isNonPremadeVoice(v: ApiVoice): boolean {
  const cat = v.category?.trim().toLowerCase();
  return Boolean(cat && cat !== "premade");
}

async function fetchV2Voices(
  apiKey: string,
  voiceType: string,
): Promise<ApiVoice[]> {
  const out: ApiVoice[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < 20; page++) {
    const url = new URL(`${ELEVEN_BASE}/v2/voices`);
    url.searchParams.set("page_size", "100");
    url.searchParams.set("voice_type", voiceType);
    if (pageToken) url.searchParams.set("next_page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { "xi-api-key": apiKey },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        text?.slice(0, 200) || `ElevenLabs v2 voices ${res.status}`,
      );
    }

    const json = (await res.json()) as {
      voices?: ApiVoice[];
      has_more?: boolean;
      next_page_token?: string | null;
    };
    out.push(...(json.voices ?? []));
    if (!json.has_more || !json.next_page_token?.trim()) break;
    pageToken = json.next_page_token.trim();
  }

  return out;
}

async function fetchV1VoicesFiltered(apiKey: string): Promise<ApiVoice[]> {
  const res = await fetch(`${ELEVEN_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text?.slice(0, 200) || `ElevenLabs voices ${res.status}`);
  }
  const json = (await res.json()) as { voices?: ApiVoice[] };
  return (json.voices ?? []).filter(isNonPremadeVoice);
}

/** Voices in the user's ElevenLabs account (My Voices — not the global premade library). */
async function loadMyVoicesFromApi(apiKey: string): Promise<{
  voices: ElevenVoiceCatalogEntry[];
  source: ElevenCatalogSource;
}> {
  const voiceTypes = ["non-default", "personal", "saved"] as const;

  for (const voiceType of voiceTypes) {
    try {
      const raw = await fetchV2Voices(apiKey, voiceType);
      const mapped = dedupeVoices(
        raw
          .map(mapApiVoice)
          .filter((v): v is ElevenVoiceCatalogEntry => v !== null),
      );
      if (mapped.length > 0) {
        return { voices: mapped, source: "my-voices-v2" };
      }
    } catch {
      /* try next voice_type or v1 */
    }
  }

  const v1Filtered = await fetchV1VoicesFiltered(apiKey);
  const mapped = dedupeVoices(
    v1Filtered
      .map(mapApiVoice)
      .filter((v): v is ElevenVoiceCatalogEntry => v !== null),
  );
  if (mapped.length > 0) {
    return { voices: mapped, source: "my-voices-v1-filter" };
  }

  return { voices: [], source: "empty" };
}

/** Voices available on the configured ElevenLabs account (server key). */
export async function getElevenLabsAccountVoices(apiKey: string): Promise<{
  voices: ElevenVoiceCatalogEntry[];
  ids: Set<string>;
  source: ElevenCatalogSource;
}> {
  const key = apiKey.trim();
  if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) {
    return { voices: cached.voices, ids: cached.ids, source: cached.source };
  }

  const { voices, source } = await loadMyVoicesFromApi(key);
  const ids = new Set(voices.map((v) => v.id));
  cached = { key, at: Date.now(), voices, ids, source };
  return { voices, ids, source };
}

export function clearElevenLabsAccountVoiceCache(): void {
  cached = null;
}
