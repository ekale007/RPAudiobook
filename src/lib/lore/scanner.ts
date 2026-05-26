import type { LoreEntry } from "@/lib/types";

function normalizeText(text: string): string {
  return text.toLowerCase();
}

function entryMatches(text: string, entry: LoreEntry): boolean {
  if (entry.enabled === false) return false;
  const haystack = normalizeText(text);
  return entry.keys.some((key) => {
    const needle = key.trim().toLowerCase();
    if (!needle) return false;
    return haystack.includes(needle);
  });
}

/** SillyTavern-style keyword scan over recent messages + optional constant entries */
export function scanActiveLore(
  entries: LoreEntry[],
  recentMessages: string[],
  options?: { maxEntries?: number },
): LoreEntry[] {
  const maxEntries = options?.maxEntries ?? 12;
  const combined = recentMessages.join("\n");

  const constant = entries.filter((e) => e.constant === true && e.enabled !== false);
  const triggered: LoreEntry[] = [];

  for (const entry of entries) {
    if (entry.constant) continue;
    if (entryMatches(combined, entry)) {
      triggered.push(entry);
    }
  }

  triggered.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));

  const seen = new Set<string>();
  const merged: LoreEntry[] = [];

  for (const e of [...constant, ...triggered]) {
    const id = e.comment ?? e.keys.join("|");
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(e);
    if (merged.length >= maxEntries) break;
  }

  return merged;
}

export function formatLoreForPrompt(entries: LoreEntry[]): string {
  if (entries.length === 0) return "";
  const blocks = entries.map(
    (e) => `### ${e.comment ?? e.keys[0]}\n${e.content}`,
  );
  return `## World Info (active)\n${blocks.join("\n\n")}`;
}

/** Rough token estimate (~4 chars per token) for budget trimming */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function trimLoreToBudget(
  entries: LoreEntry[],
  budgetTokens: number,
): LoreEntry[] {
  const result: LoreEntry[] = [];
  let used = 0;
  for (const entry of entries) {
    const block = `${entry.content}\n`;
    const cost = estimateTokens(block);
    if (used + cost > budgetTokens) break;
    result.push(entry);
    used += cost;
  }
  return result;
}
