const DB_NAME = "hoerbuchki-tts";
const STORE = "audio";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function getCachedAudio(cacheKey: string): Promise<Blob | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(cacheKey);
    req.onsuccess = () => {
      const val = req.result as Blob | undefined;
      resolve(val ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function setCachedAudio(cacheKey: string, blob: Blob): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, cacheKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function buildTtsCacheKey(
  voiceKey: string,
  provider: string,
  text: string,
): string {
  const sample = `${provider}|${voiceKey}|${text.slice(0, 200)}|${text.length}`;
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = (hash << 5) - hash + sample.charCodeAt(i);
    hash |= 0;
  }
  return `tts-${provider}-${Math.abs(hash)}-${text.length}`;
}
