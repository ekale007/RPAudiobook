import type { TurnRow } from "@/lib/db/stories";

/** Index of the user turn that started the current assistant block(s). */
export function findPrecedingUserIndex(
  turns: TurnRow[],
  fromArrayIndex: number,
): number | null {
  for (let i = fromArrayIndex; i >= 0; i--) {
    if (turns[i].role === "user") return turns[i].index_in_chapter;
  }
  return null;
}

/** First turn index to delete when rerolling this assistant message. */
export function rerollDeleteFromIndex(
  turns: TurnRow[],
  assistantTurnId: string,
): number | null {
  const i = turns.findIndex((t) => t.id === assistantTurnId);
  if (i < 0 || turns[i].role !== "assistant") return null;
  return turns[i].index_in_chapter;
}

export function nextTurnIndex(turns: TurnRow[]): number {
  if (!turns.length) return 0;
  return Math.max(...turns.map((t) => t.index_in_chapter)) + 1;
}
