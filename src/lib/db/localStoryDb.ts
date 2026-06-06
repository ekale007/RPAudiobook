const DB_NAME = "hoerbuchki-local-stories";
const VERSION = 1;

export type LocalStoreName =
  | "stories"
  | "characters"
  | "lorebooks"
  | "story_lorebooks"
  | "bands"
  | "chapters"
  | "turns";

let dbPromise: Promise<IDBDatabase> | null = null;

export function isLocalDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!isLocalDbAvailable()) {
    return Promise.reject(new Error("IndexedDB nicht verfügbar."));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("stories")) {
          db.createObjectStore("stories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("characters")) {
          const s = db.createObjectStore("characters", { keyPath: "id" });
          s.createIndex("story_id", "story_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("lorebooks")) {
          const s = db.createObjectStore("lorebooks", { keyPath: "id" });
          s.createIndex("story_id", "story_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("story_lorebooks")) {
          db.createObjectStore("story_lorebooks", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("bands")) {
          const s = db.createObjectStore("bands", { keyPath: "id" });
          s.createIndex("story_id", "story_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("chapters")) {
          const s = db.createObjectStore("chapters", { keyPath: "id" });
          s.createIndex("band_id", "band_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("turns")) {
          const s = db.createObjectStore("turns", { keyPath: "id" });
          s.createIndex("chapter_id", "chapter_id", { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function localDbGet<T>(
  store: LocalStoreName,
  key: string,
): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function localDbPut<T extends { id: string }>(
  store: LocalStoreName,
  value: T,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function localDbDelete(
  store: LocalStoreName,
  key: string,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function localDbGetAll<T>(store: LocalStoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function localDbGetByIndex<T>(
  store: LocalStoreName,
  indexName: string,
  value: string,
): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const idx = tx.objectStore(store).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function localDbDeleteByIndex(
  store: LocalStoreName,
  indexName: string,
  value: string,
): Promise<void> {
  const rows = await localDbGetByIndex<{ id: string }>(store, indexName, value);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const row of rows) {
      os.delete(row.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
