/** Built-in SFX catalog — add matching OGG files under public/sfx/ (see docs/SFX.md). */

import type { StoryPlotState } from "@/lib/memory/plotState";

export type SfxEntry = {
  id: string;
  label: string;
  /** Path under public/ */
  path: string;
  loop: boolean;
  /** 0–1 gain when mixed under TTS */
  volume: number;
};

export const SFX_CATALOG: Record<string, SfxEntry> = {
  rain: {
    id: "rain",
    label: "Regen (Ambience)",
    path: "/sfx/rain.wav",
    loop: true,
    volume: 0.12,
  },
  "rain-indoors": {
    id: "rain-indoors",
    label: "Regen (innen)",
    path: "/sfx/rain_indoors.wav",
    loop: true,
    volume: 0.1,
  },
  wind: {
    id: "wind",
    label: "Wind",
    path: "/sfx/wind_2.wav",
    loop: true,
    volume: 0.1,
  },
  city: {
    id: "city",
    label: "Stadt-Ambiente",
    path: "/sfx/city.wav",
    loop: true,
    volume: 0.1,
  },
  fire: {
    id: "fire",
    label: "Feuer",
    path: "/sfx/fire-1.ogg",
    loop: true,
    volume: 0.14,
  },
  door: {
    id: "door",
    label: "Tür (öffnen)",
    path: "/sfx/doorOpen_1.ogg",
    loop: false,
    volume: 0.35,
  },
  "door-close": {
    id: "door-close",
    label: "Tür (schließen)",
    path: "/sfx/doorClose_2.ogg",
    loop: false,
    volume: 0.35,
  },
  footsteps: {
    id: "footsteps",
    label: "Schritte",
    path: "/sfx/footstep01.ogg",
    loop: false,
    volume: 0.28,
  },
  creak: {
    id: "creak",
    label: "Knarren",
    path: "/sfx/creak2.ogg",
    loop: false,
    volume: 0.32,
  },
  thunder: {
    id: "thunder",
    label: "Donner",
    path: "/sfx/thunder_2_far.wav",
    loop: false,
    volume: 0.38,
  },
};

const SFX_TAG_RE = /<<sfx:([a-z0-9_-]+)>>/gi;

/** Extract sfx ids from story text, e.g. <<sfx:rain>> */
export function parseSfxTags(text: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SFX_TAG_RE.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const id = m[1]?.toLowerCase();
    if (id && SFX_CATALOG[id] && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Whole-word match — avoids "rain" in "terrain", "regen" in "regeneration", etc. */
export function hayHasAmbienceToken(hay: string, tokens: string[]): boolean {
  const pad = ` ${hay.toLowerCase().replace(/\s+/g, " ")} `;
  return tokens.some((t) => pad.includes(` ${t.toLowerCase()} `));
}

/** Ambient loops from plot location (no LLM). */
export function ambienceIdsFromPlot(
  plot: StoryPlotState | null | undefined,
): string[] {
  if (!plot) return [];
  const hay = [
    plot.location,
    plot.timeLabel,
    ...plot.openThreads,
  ]
    .filter(Boolean)
    .join(" ");
  if (!hay.trim()) return [];
  const ids: string[] = [];
  if (
    hayHasAmbienceToken(hay, [
      "regen",
      "rain",
      "regenschauer",
      "rainfall",
      "sturm",
      "storm",
      "gewitter",
    ]) &&
    SFX_CATALOG.rain
  ) {
    ids.push("rain");
  }
  if (
    hayHasAmbienceToken(hay, ["wind", "sturm", "storm", "orkan", "gale"]) &&
    SFX_CATALOG.wind
  ) {
    ids.push("wind");
  }
  if (
    hayHasAmbienceToken(hay, [
      "stadt",
      "city",
      "markt",
      "market",
      "street",
      "straße",
      "strasse",
      "pier",
      "harbor",
      "harbour",
      "hafen",
    ]) &&
    SFX_CATALOG.city
  ) {
    ids.push("city");
  }
  if (
    hayHasAmbienceToken(hay, [
      "feuer",
      "fire",
      "flamme",
      "flame",
      "brand",
      "inferno",
    ]) &&
    SFX_CATALOG.fire
  ) {
    ids.push("fire");
  }
  if (
    hayHasAmbienceToken(hay, ["gewitter", "thunder", "blitz", "lightning"]) &&
    SFX_CATALOG.thunder
  ) {
    ids.push("thunder");
  }
  return ids;
}

/** Remove sfx tags before TTS synthesis. */
export function stripSfxTags(text: string): string {
  return text.replace(SFX_TAG_RE, "").replace(/\s{2,}/g, " ").trim();
}

export function getSfxEntry(id: string): SfxEntry | null {
  return SFX_CATALOG[id.toLowerCase()] ?? null;
}
