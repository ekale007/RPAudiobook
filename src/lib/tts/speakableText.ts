/** True if text is worth sending to TTS (not only punctuation/whitespace). */
export function isSpeakableForTts(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const letters = t.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2;
}

/** Last-resort cleanup when the engine rejects input. */
export function sanitizeTextForTtsRetry(text: string): string {
  return text
    .replace(/<<\s*speaker\s*:[^>]+>>/gi, " ")
    .replace(/\*[^*]+\*/g, " ")
    .replace(/[^\p{L}\p{N}\s.,!?;:'"„""\-–—]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
