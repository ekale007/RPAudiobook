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

/** Prompt when rerolling (history may end on user or assistant). */
export function rerollAssistantPrompt(endsOnUser: boolean): string {
  if (endsOnUser) {
    return "Write a fresh narrator response to the user's last message above. Same intent and story beat, new wording — do not repeat the previous reply verbatim.";
  }
  return "Rewrite your last narrator passage with the same story beat and tone, but fresh wording. Continue naturally from the scene.";
}
