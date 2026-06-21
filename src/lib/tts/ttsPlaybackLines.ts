/** Tokenize visible turn text for TTS read-along (word highlight). */

export type PlaybackToken = {
  text: string;
  /** Counts toward speak-time mapping (words only). */
  isWord: boolean;
  weight: number;
};

function wordWeight(text: string): number {
  const letters = text.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length > 0 ? letters.length : 1;
}

/** Split into words and whitespace/punctuation chunks (display order preserved). */
export function tokenizeTextForPlayback(text: string): PlaybackToken[] {
  if (!text) return [];
  const tokens: PlaybackToken[] = [];
  const re = /\S+|\s+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const chunk = match[0]!;
    const isWord = /\p{L}|\p{N}/u.test(chunk);
    tokens.push({
      text: chunk,
      isWord,
      weight: isWord ? wordWeight(chunk) : 0,
    });
  }
  return tokens;
}

/** Map playback progress (0–1) to token index (word token). */
export function activeWordTokenIndexForProgress(
  tokens: PlaybackToken[],
  progress: number,
): number {
  const wordIndices: number[] = [];
  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (!t.isWord || t.weight <= 0) continue;
    wordIndices.push(i);
    total += t.weight;
  }
  if (!wordIndices.length) return 0;

  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return wordIndices[0]!;
  if (p >= 1) return wordIndices[wordIndices.length - 1]!;

  let remaining = p * total;
  for (const idx of wordIndices) {
    remaining -= tokens[idx]!.weight;
    if (remaining <= 0) return idx;
  }
  return wordIndices[wordIndices.length - 1]!;
}

/** @deprecated Use tokenizeTextForPlayback — kept for tests. */
export type PlaybackLine = { text: string; weight: number };

export function splitTextIntoPlaybackLines(text: string): PlaybackLine[] {
  return tokenizeTextForPlayback(text)
    .filter((t) => t.isWord)
    .map((t) => ({ text: t.text, weight: t.weight }));
}

export function activeLineIndexForProgress(
  lines: PlaybackLine[],
  progress: number,
): number {
  if (!lines.length) return 0;
  const tokens: PlaybackToken[] = lines.map((l) => ({
    text: l.text,
    isWord: true,
    weight: l.weight,
  }));
  return activeWordTokenIndexForProgress(tokens, progress);
}
