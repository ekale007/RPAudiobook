import { defaultContinuePrompt } from "@/lib/chat/storyBeatSuggestions";

export const AUTO_PLAY_TURN_OPTIONS = [2, 3, 5] as const;
export type AutoPlayTurnCount = (typeof AUTO_PLAY_TURN_OPTIONS)[number];
export const DEFAULT_AUTO_PLAY_TURNS: AutoPlayTurnCount = 3;

/** Hands-free listening sessions (approximate wall-clock). */
export const DRIVE_MODE_MINUTES = [30, 60] as const;
export type DriveModeMinutes = (typeof DRIVE_MODE_MINUTES)[number];

const AUTO_EXTRA =
  " Keep pacing steady; no time skips unless the player already moved time forward. Each new beat must **pick up mid-scene** — never re-open with the same establishing imagery as the prior beat.";

export function autoContinuePrompt(): string {
  return defaultContinuePrompt() + AUTO_EXTRA;
}
