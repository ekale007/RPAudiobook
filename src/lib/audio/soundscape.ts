import {
  ambienceIdsFromPlot,
  getSfxEntry,
  parseSfxTags,
  type SfxEntry,
} from "@/lib/audio/sfxCatalog";
import { isPlotStateEmpty } from "@/lib/memory/plotState";
import { isStoryDeliveryEnabled } from "@/lib/tts/resolveStoryDelivery";
import type { StorySettings } from "@/lib/types";

export type StorySoundscape = {
  /** Looping beds (rain, wind, …). */
  ambient?: string[];
  /** Single looping music bed id from catalog. */
  music?: string | null;
  /** One-shots fired at turn start (door, thunder, …). */
  oneShots?: string[];
};

export type ResolvedTurnSound = {
  ambient: string[];
  music: string | null;
  oneShots: string[];
};

const MUSIC_TAG_RE = /<<music:([a-z0-9_-]+)>>/gi;

export function parseMusicTag(text: string): string | null {
  MUSIC_TAG_RE.lastIndex = 0;
  const m = MUSIC_TAG_RE.exec(text);
  const id = m?.[1]?.toLowerCase();
  return id && getSfxEntry(id)?.bus === "music" ? id : null;
}

/** Optional music bed from plot threats / mood (no LLM). */
export function musicIdFromPlot(
  plot: StorySettings["plotState"],
): string | null {
  if (!plot || isPlotStateEmpty(plot)) return null;
  const hay = [
    plot.location,
    plot.timeLabel,
    ...plot.openThreads,
    ...plot.threats.map((t) => `${t.label} ${t.status} ${t.detail}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!hay.trim()) return null;

  const tense =
    /threat|danger|gefehr|verfolg|jagd|kampf|fight|chase|urgent|tense|dread|angst|panic/i.test(
      hay,
    ) || plot.threats.some((t) => t.status === "active");
  if (tense && getSfxEntry("music-tension")) return "music-tension";

  const calm =
    /ruhig|calm|peace|safe|hearth|fireplace|warm|gemütlich|cozy|tavern|gasthaus/i.test(
      hay,
    );
  if (calm && getSfxEntry("music-calm")) return "music-calm";

  const mystery =
    /mystery|geheim|schatten|shadow|whisper|nebel|fog|crypt|dungeon/i.test(hay);
  if (mystery && getSfxEntry("music-mystery")) return "music-mystery";

  return null;
}

function unique(ids: string[]): string[] {
  return ids.filter((id, i, arr) => arr.indexOf(id) === i);
}

export function resolveTurnSound(args: {
  rawContent?: string | null;
  text?: string | null;
  storySettings?: StorySettings | null;
}): ResolvedTurnSound {
  const source = (args.rawContent ?? args.text ?? "").trim();
  const sfxTags = parseSfxTags(source);
  const deliveryOn = isStoryDeliveryEnabled(args.storySettings);
  const plot = args.storySettings?.plotState;

  const ambientFromPlot =
    deliveryOn && !isPlotStateEmpty(plot) ? ambienceIdsFromPlot(plot) : [];
  const musicFromPlot =
    deliveryOn && !isPlotStateEmpty(plot) ? musicIdFromPlot(plot) : null;

  const configured = args.storySettings?.soundscape;
  const ambient = unique([
    ...(configured?.ambient ?? []),
    ...ambientFromPlot,
    ...sfxTags.filter((id) => {
      const e = getSfxEntry(id);
      return e?.loop && e.bus === "ambience";
    }),
  ]);

  const oneShots = unique([
    ...(configured?.oneShots ?? []),
    ...sfxTags.filter((id) => {
      const e = getSfxEntry(id);
      return e && !e.loop;
    }),
  ]);

  const music =
    configured?.music ??
    parseMusicTag(source) ??
    musicFromPlot ??
    null;

  return { ambient, music, oneShots };
}

export function stripSoundTags(text: string): string {
  return text
    .replace(/<<music:[a-z0-9_-]+>>/gi, "")
    .replace(/<<sfx:[a-z0-9_-]+>>/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isMusicEntry(entry: SfxEntry): boolean {
  return entry.bus === "music";
}
