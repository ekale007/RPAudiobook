import type { TurnRow } from "@/lib/db/stories";

export const AUTO_CHAPTER_MIN_TURNS = 36;
export const AUTO_CHAPTER_HARD_TURNS = 56;
export const AUTO_CHAPTER_SOFT_CHARS = 14000;

export function estimateTranscriptChars(rows: TurnRow[]): number {
  return rows.reduce((sum, r) => sum + r.content.length, 0);
}

/**
 * Heuristic for natural chapter size in interactive fiction:
 * - soft target after enough turns + substantial transcript size
 * - hard stop at very long chats to avoid context bloat
 */
export function shouldAutoCreateNextChapter(rows: TurnRow[]): boolean {
  if (!rows.length) return false;
  const turns = rows.length;
  const chars = estimateTranscriptChars(rows);
  if (turns >= AUTO_CHAPTER_HARD_TURNS) return true;
  if (turns >= AUTO_CHAPTER_MIN_TURNS && chars >= AUTO_CHAPTER_SOFT_CHARS) {
    return true;
  }
  return false;
}

