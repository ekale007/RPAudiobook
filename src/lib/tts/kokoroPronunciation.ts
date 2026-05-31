import type { CharacterRow } from "@/lib/db/stories";
import type { PronunciationMap } from "@/lib/tts/pronunciation";
import { speakerTtsLabel } from "@/lib/tts/speakerTtsName";
import type { TtsSettings } from "@/lib/storage/ttsSettings";

/** Default Kokoro respellings (capital stress). User map overrides these. */
export const KOKORO_SPEAK_DEFAULTS: PronunciationMap = {
  Elias: "Elias",
  Naya: "NaYa",
  Kaelen: "KaALean",
  Marcus: "Markus",
  Lucifer: "Lucifer",
  Tess: "Tess",
  Gabriel: "Gabriel",
  Vellani: "Vellani",
};

export const KOKORO_PRONUNCIATION_TEMPLATE = `Lucifer — The Devil => Lucifer
Lucifer the Devil => Lucifer
Kaelen => KaALean
Kaelen Vellen => KaALean
Marcus => Markus
Elias => Elias
Naya => NaYa
Naya Vellen => NaYa`;

export function isKokoroEngine(settings: TtsSettings): boolean {
  return settings.provider === "local" && settings.localEngine === "kokoro";
}

/** Replace full card titles in prose before other pronunciation rules. */
export function applyCastCardNameAliases(
  text: string,
  cast: CharacterRow[],
): string {
  let out = text;
  const entries = cast
    .filter((c) => c.role === "cast" && c.name?.trim())
    .map((c) => ({
      full: c.name.trim(),
      short: speakerTtsLabel(c.name),
    }))
    .filter((e) => e.full.length > 0 && e.short.length > 0 && e.full !== e.short)
    .sort((a, b) => b.full.length - a.full.length);

  for (const { full, short } of entries) {
    const re = new RegExp(escapeRegex(full), "gi");
    out = out.replace(re, short);
  }
  return out;
}

export function buildEffectivePronunciationMap(
  settings: TtsSettings,
  cast: CharacterRow[],
): PronunciationMap {
  const user = { ...(settings.pronunciationMap ?? {}) };
  const merged: PronunciationMap = {};

  if (isKokoroEngine(settings)) {
    Object.assign(merged, KOKORO_SPEAK_DEFAULTS);
  }

  for (const c of cast.filter((row) => row.role === "cast" && row.name?.trim())) {
    const full = c.name.trim();
    const short = speakerTtsLabel(full);
    const speak =
      user[short] ??
      user[full] ??
      (isKokoroEngine(settings) ? KOKORO_SPEAK_DEFAULTS[short] : undefined) ??
      short;

    if (full !== short) merged[full] = speak;
    merged[short] = speak;

    // "Kaelen Vellen" in prose when card uses full name
    if (full.includes(" ") && short && full !== short) {
      merged[full] = speak;
    }
  }

  // User overrides win
  Object.assign(merged, user);
  return merged;
}

export function applyKokoroNameHints(
  text: string,
  map: PronunciationMap,
): string {
  const customKeys = new Set(
    Object.keys(map).map((k) => k.trim().toLowerCase()),
  );
  let out = text;
  for (const [source, replacement] of Object.entries(KOKORO_SPEAK_DEFAULTS)) {
    if (customKeys.has(source.toLowerCase())) continue;
    const re = new RegExp(`\\b${escapeRegex(source)}\\b`, "gi");
    out = out.replace(re, replacement);
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lines for the pronunciation textarea (cast card titles + Kokoro defaults). */
export function buildCastPronunciationSuggestions(
  cast: CharacterRow[],
  settings: TtsSettings,
): string {
  const kokoro = isKokoroEngine(settings);
  const lines: string[] = kokoro
    ? KOKORO_PRONUNCIATION_TEMPLATE.split(/\r?\n/).filter(Boolean)
    : [];

  const seen = new Set<string>();
  for (const raw of lines) {
    seen.add(raw.split(/\s*=>\s*/)[0]?.trim().toLowerCase() ?? "");
  }

  for (const c of cast.filter((row) => row.role === "cast" && row.name?.trim())) {
    const full = c.name.trim();
    const short = speakerTtsLabel(full);
    const speak =
      (settings.pronunciationMap ?? {})[short] ??
      (kokoro ? KOKORO_SPEAK_DEFAULTS[short] : undefined) ??
      short;

    for (const source of [full, short]) {
      const key = source.toLowerCase();
      if (!source || seen.has(key)) continue;
      seen.add(key);
      lines.push(`${source} => ${speak}`);
    }
  }

  return lines.join("\n");
}
