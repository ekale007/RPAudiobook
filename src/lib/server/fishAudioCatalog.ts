import { getFishAudioApiKey } from "@/lib/server/env";

export type FishVoiceCatalogEntry = {
  id: string;
  label: string;
  hint: string;
  languages: string[];
  state: string;
};

export type FishVoiceCatalogSource =
  | "my-voices"
  | "empty"
  | "static-no-key"
  | "upstream-error";

export type FishVoiceCatalogResult = {
  voices: FishVoiceCatalogEntry[];
  source: FishVoiceCatalogSource;
  hint: string;
};

const FISH_MODELS_URL = "https://api.fish.audio/model";

type FishModelRow = {
  _id?: string;
  title?: string;
  state?: string;
  languages?: string[];
  description?: string;
};

function mapFishRow(row: FishModelRow): FishVoiceCatalogEntry | null {
  const id = row._id?.trim();
  if (!id) return null;
  const title = row.title?.trim() || "Unbenannt";
  const langs = (row.languages ?? []).filter(Boolean);
  const langHint = langs.length ? langs.join(", ") : "Sprache unbekannt";
  const state = row.state?.trim() || "unknown";
  return {
    id,
    label: title,
    hint: `${langHint} · ${state}`,
    languages: langs,
    state,
  };
}

/** Voices cloned/owned on the Fish Audio account (self=true). */
export async function getFishAudioVoiceCatalog(): Promise<FishVoiceCatalogResult> {
  const apiKey = getFishAudioApiKey();
  if (!apiKey) {
    return {
      voices: [],
      source: "static-no-key",
      hint: "Kein Server-Key — FISH_AUDIO_API_KEY in Vercel setzen.",
    };
  }

  const voices: FishVoiceCatalogEntry[] = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore && page <= 20) {
      const url = new URL(FISH_MODELS_URL);
      url.searchParams.set("self", "true");
      url.searchParams.set("page_size", "50");
      url.searchParams.set("page_number", String(page));

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return {
          voices: [],
          source: "upstream-error",
          hint:
            errText?.slice(0, 200) ||
            `Fish-Stimmenliste fehlgeschlagen (${res.status}).`,
        };
      }

      const json = (await res.json()) as {
        items?: FishModelRow[];
        has_more?: boolean | null;
      };

      for (const row of json.items ?? []) {
        if (row.state && row.state !== "trained") continue;
        const mapped = mapFishRow(row);
        if (mapped) voices.push(mapped);
      }

      hasMore = Boolean(json.has_more);
      page += 1;
      if (!json.items?.length) break;
    }
  } catch (e) {
    return {
      voices: [],
      source: "upstream-error",
      hint: e instanceof Error ? e.message : "Fish-Stimmenliste fehlgeschlagen.",
    };
  }

  if (!voices.length) {
    return {
      voices: [],
      source: "empty",
      hint:
        "Keine eigenen Stimmen im Fish-Konto. Auf fish.audio klonen oder unten eine reference_id eintragen.",
    };
  }

  return {
    voices,
    source: "my-voices",
    hint: `${voices.length} Stimme(n) aus deinem Fish-Audio-Konto.`,
  };
}
