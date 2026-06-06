/** Prefix for all client-only story entities (story, chapter, turn, …). */
export const LOCAL_ID_PREFIX = "local-";

export function isLocalStoryId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

export function isLocalEntityId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

export function newLocalId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${LOCAL_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
