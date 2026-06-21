/**
 * Restrict `/api/tts/local` upstream targets to loopback / private LAN only (SSRF mitigation).
 */
export function resolveAllowedLocalTtsUrl(
  requested: string | undefined,
  envFallback: string | undefined,
  defaultUrl: string,
): string {
  const raw = requested?.trim() || envFallback?.trim() || defaultUrl;
  const base = raw.replace(/\/$/, "");
  assertAllowedLocalTtsUrl(base);
  return base;
}

export function assertAllowedLocalTtsUrl(serverUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error("Invalid TTS server URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("TTS server URL must use http or https");
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return;

  throw new Error(
    "TTS server URL must point to localhost or a private LAN address (127.0.0.1, 10.x, 192.168.x, 172.16–31.x)",
  );
}
