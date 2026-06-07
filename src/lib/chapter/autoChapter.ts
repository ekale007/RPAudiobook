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

export type ChapterCompletionProgress = {
  percent: number;
  remainingPercent: number;
  ready: boolean;
  hardLimit: boolean;
  turns: number;
  chars: number;
};

/** Progress toward the recommended chapter close (soft: turns + chars; hard: max turns). */
export function chapterCompletionProgress(
  rows: TurnRow[],
): ChapterCompletionProgress {
  const turns = rows.length;
  const chars = estimateTranscriptChars(rows);
  const hardLimit = turns >= AUTO_CHAPTER_HARD_TURNS;
  const ready = shouldAutoCreateNextChapter(rows);

  if (hardLimit) {
    return {
      percent: 100,
      remainingPercent: 0,
      ready: true,
      hardLimit: true,
      turns,
      chars,
    };
  }

  const turnPct = Math.min(100, (turns / AUTO_CHAPTER_MIN_TURNS) * 100);
  const charPct = Math.min(100, (chars / AUTO_CHAPTER_SOFT_CHARS) * 100);
  const percent = Math.round(Math.min(turnPct, charPct));

  return {
    percent,
    remainingPercent: Math.max(0, 100 - percent),
    ready,
    hardLimit: false,
    turns,
    chars,
  };
}

