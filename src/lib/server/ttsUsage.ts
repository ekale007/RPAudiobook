/** ElevenLabs response headers for usage logging. */

export function readElevenLabsUsageHeaders(
  headers: Headers,
): { characters: number; requestId: string | null } {
  const charRaw =
    headers.get("x-character-count") ??
    headers.get("character-cost") ??
    headers.get("xi-character-count");
  const characters = charRaw ? Number.parseInt(charRaw, 10) : 0;
  const requestId =
    headers.get("request-id") ?? headers.get("xi-request-id");
  return {
    characters: Number.isFinite(characters) ? characters : 0,
    requestId: requestId?.trim() || null,
  };
}
