/** Split visible turn text into lines for TTS read-along highlighting. */

export type PlaybackLine = {
  text: string;
  /** Speakable length proxy for time mapping (chars). */
  weight: number;
};

function speakableWeight(text: string): number {
  const n = text.replace(/\s+/g, " ").trim().length;
  return n > 0 ? n : 1;
}

function splitBySentences(text: string): PlaybackLine[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return [{ text: trimmed, weight: speakableWeight(trimmed) }];
  }
  return parts.map((t) => ({ text: t, weight: speakableWeight(t) }));
}

/** Prefer paragraph/line breaks; fall back to sentences for single blocks. */
export function splitTextIntoPlaybackLines(text: string): PlaybackLine[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const byNewline = normalized
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (byNewline.length > 1) {
    return byNewline.map((t) => ({ text: t, weight: speakableWeight(t) }));
  }

  return splitBySentences(normalized);
}

/** Map playback progress (0–1) to a line index. */
export function activeLineIndexForProgress(
  lines: PlaybackLine[],
  progress: number,
): number {
  if (!lines.length) return 0;
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return 0;
  if (p >= 1) return lines.length - 1;

  const total = lines.reduce((sum, line) => sum + line.weight, 0);
  let remaining = p * total;
  for (let i = 0; i < lines.length; i++) {
    remaining -= lines[i]!.weight;
    if (remaining <= 0) return i;
  }
  return lines.length - 1;
}
