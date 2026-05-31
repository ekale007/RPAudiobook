/** Client-side cache of /api/health — no NEXT_PUBLIC flags required. */

export type ServerCapabilities = {
  serverTts: boolean;
  serverLlm: boolean;
};

let cached: ServerCapabilities | null = null;
let inflight: Promise<ServerCapabilities> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function getServerCapabilitiesSync(): ServerCapabilities {
  return cached ?? { serverTts: false, serverLlm: false };
}

export function subscribeServerCapabilities(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshServerCapabilities(): Promise<ServerCapabilities> {
  if (inflight) return inflight;

  inflight = fetch("/api/health", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Partial<ServerCapabilities>;
      cached = {
        serverTts: Boolean(json.serverTts),
        serverLlm: Boolean(json.serverLlm),
      };
      notify();
      return cached;
    })
    .catch(() => {
      cached = { serverTts: false, serverLlm: false };
      notify();
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function isServerTtsAvailable(): boolean {
  if (process.env.NEXT_PUBLIC_SERVER_TTS === "1") return true;
  return getServerCapabilitiesSync().serverTts;
}

export function isServerLlmAvailable(): boolean {
  if (process.env.NEXT_PUBLIC_SERVER_LLM === "1") return true;
  return getServerCapabilitiesSync().serverLlm;
}
