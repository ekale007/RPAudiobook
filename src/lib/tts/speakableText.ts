/** True if text is worth sending to TTS (not only punctuation/whitespace). */
export function isSpeakableForTts(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const letters = t.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2;
}

/**
 * Strip RP emphasis / thought markers before TTS (*action*, _italic_, **bold**).
 * Keeps inner text; removes orphan asterisks from split multi-voice segments.
 */
export function stripRoleplayMarkupForTts(text: string): string {
  let out = text;
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/\*([^*\n]+)\*/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/_([^_\n]+)_/g, "$1");
  out = out.replace(/\*/g, "");
  return out;
}

/** Last-resort cleanup when the engine rejects input. */
export function sanitizeTextForTtsRetry(text: string): string {
  return stripRoleplayMarkupForTts(text)
    .replace(/<<\s*speaker\s*:[^>]+>>/gi, " ")
    .replace(/[^\p{L}\p{N}\s.,!?;:'"„""\-–—]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
