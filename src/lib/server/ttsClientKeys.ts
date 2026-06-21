/** Client-supplied API keys for local-first TTS proxies (never log these). */

export function readBearerClientKey(req: Request): string | null {
  const auth = req.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const key = auth.slice(7).trim();
    if (key) return key;
  }
  return (
    req.headers.get("x-fish-api-key")?.trim() ||
    req.headers.get("x-openrouter-api-key")?.trim() ||
    null
  );
}
