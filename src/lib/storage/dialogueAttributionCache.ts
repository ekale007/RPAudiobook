export type CachedDialogueAttribution = {
  contentHash: string;
  attributions: Record<string, string>;
  reasons?: Record<string, string[]>;
  source: "llm";
  cachedAt: string;
};

const PREFIX = "hoerbuchki.dialogueAttr.";

export function hashTurnContent(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = (h * 33) ^ content.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function loadDialogueAttributionCache(
  turnId: string,
  content: string,
): CachedDialogueAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${turnId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDialogueAttribution;
    if (parsed.contentHash !== hashTurnContent(content)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDialogueAttributionCache(
  turnId: string,
  entry: CachedDialogueAttribution,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}${turnId}`, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function clearDialogueAttributionCache(turnId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${PREFIX}${turnId}`);
}
