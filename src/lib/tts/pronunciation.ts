export type PronunciationMap = Record<string, string>;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function serializePronunciationMap(map: PronunciationMap): string {
  return Object.entries(map)
    .filter(([k, v]) => k.trim().length > 0 && v.trim().length > 0)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([k, v]) => `${k} => ${v}`)
    .join("\n");
}

/**
 * Format per line:
 *   Source => Replacement
 * Empty lines and comments (#) are ignored.
 */
export function parsePronunciationLines(input: string): PronunciationMap {
  const map: PronunciationMap = {};
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s*=>\s*/);
    if (parts.length < 2) continue;
    const source = parts[0]?.trim();
    const replacement = normalizePronunciationReplacement(
      parts.slice(1).join("=>").trim(),
    );
    if (!source || !replacement) continue;
    map[source] = replacement;
  }
  return map;
}

export function applyPronunciationOverrides(
  text: string,
  map: PronunciationMap | undefined,
): string {
  if (!map) return text;
  let out = text;
  const entries = Object.entries(map)
    .filter(([k, v]) => k.trim().length > 0 && v.trim().length > 0)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [fromRaw, to] of entries) {
    const from = fromRaw.trim();
    // token-like names; allow possessive continuation (Elias's)
    const re = new RegExp(`\\b${escapeRegex(from)}\\b`, "gi");
    out = out.replace(re, to);
  }
  return out;
}

function normalizePronunciationReplacement(input: string): string {
  // Most local/cloud TTS engines work best with a single respelled token.
  // Example: "NAA-yaa" -> "NAAyaa", "Eh LEE as" -> "EhLEEas".
  const compact = input
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s*-\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return compact.includes(" ") ? compact.replace(/\s+/g, "") : compact;
}

