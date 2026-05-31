import {
  formatPlotStateForPrompt,
  type StoryPlotState,
} from "@/lib/memory/plotState";
import {
  formatPinsForPrompt,
  type StoryPin,
} from "@/lib/memory/storyPins";

/**
 * Assembles long-term story memory for the system prompt without duplication
 * and with clear rules so recent chat wins over stale summaries.
 */

export type StoryMemoryInput = {
  plotState?: StoryPlotState | null;
  pinnedNotes?: StoryPin[];
  bandSummary?: string | null;
  priorChapterSummaries?: string | null;
  rollingSummary?: string | null;
  chapterTitle?: string | null;
  phaseHint?: string | null;
  chapterIndex?: number;
  closedChapterCount?: number;
};

const MEMORY_RULES = `## Memory rules (follow strictly)
- **Plot state** (if present) overrides character card defaults, scenario text, and old countdown tags.
- The **most recent chat messages** in this request are the source of truth for what just happened.
- If any prose summary below conflicts with plot state or recent messages, **ignore the summary** for those facts.
- **Never rewind time** unless the latest scene explicitly does.
- **Present** in plot state = physically in the current scene right now. **Absent** or **Scheduled** characters must NOT appear, speak, or act as if present until in-story time catches up and they explicitly return.
- When the player returns to a location after minutes or hours, do NOT repopulate NPCs who left unless plot state or the latest messages show they came back.
- Do NOT repeat or undo **resolved** events (defeated enemies, public revelations) unless the player explicitly rewinds in the app.
- Do NOT restart from the opening scenario, first meeting, tutorial beats, or Act I set-pieces — the story has already moved forward.
- Do NOT run a background countdown for threats marked defeated/cancelled in plot state.`;

function buildProgressSection(input: StoryMemoryInput): string | null {
  const idx = input.chapterIndex;
  const closed = input.closedChapterCount;
  if (idx == null || idx < 1) return null;
  const closedLabel =
    closed != null && closed > 0
      ? `${closed} earlier chapter${closed === 1 ? "" : "s"} already completed`
      : "ongoing story";
  return `## Story progress
You are continuing an **ongoing** interactive story — **Chapter ${idx}** (${closedLabel}).
Continue from the latest timeline and location. Never loop back to the story's opening unless the player explicitly rewinds.`;
}

export function buildStoryMemorySections(input: StoryMemoryInput): string[] {
  const sections: string[] = [];

  const progress = buildProgressSection(input);
  if (progress) sections.push(progress);

  const plotBlock = formatPlotStateForPrompt(input.plotState);
  if (plotBlock) sections.push(plotBlock);

  const pinBlock = formatPinsForPrompt(input.pinnedNotes);
  if (pinBlock) sections.push(pinBlock);

  const band = input.bandSummary?.trim();
  const prior = input.priorChapterSummaries?.trim();

  if (band) {
    sections.push(`## Earlier story (closed chapters)\n${band}`);
  } else if (prior) {
    sections.push(`## Earlier story (closed chapters)\n${prior}`);
  }

  const currentParts: string[] = [];
  if (input.chapterTitle?.trim()) {
    currentParts.push(`Active chapter: ${input.chapterTitle.trim()}`);
  }
  if (input.phaseHint?.trim()) {
    currentParts.push(`Timeline phase (author hint): ${input.phaseHint.trim()}`);
  }
  if (input.rollingSummary?.trim()) {
    currentParts.push(input.rollingSummary.trim());
  }

  if (currentParts.length) {
    sections.push(
      `## Current chapter (compressed memory — check recent messages if unsure)\n${currentParts.join("\n\n")}`,
    );
  }

  sections.push(MEMORY_RULES);
  return sections;
}
