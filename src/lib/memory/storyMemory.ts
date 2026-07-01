import {
  formatPlotStateForPrompt,
  type StoryPlotState,
} from "@/lib/memory/plotState";
import {
  formatTimelineForPrompt,
  type StoryTimeline,
} from "@/lib/memory/storyTimeline";
import {
  formatPinsForPrompt,
  type StoryPin,
} from "@/lib/memory/storyPins";
import {
  buildMemoryLayers,
  enforcePromptBudget,
  DEFAULT_PROMPT_BUDGET_CHARS,
  type BudgetPlan,
} from "@/lib/memory/promptBudget";
import {
  formatReflectionsForPrompt,
  type ReflectionsContainer,
} from "@/lib/memory/reflections";

/**
 * Assembles long-term story memory for the system prompt without duplication
 * and with clear rules so recent chat wins over stale summaries.
 *
 * Phase 7.3: smart-prompt-budget (Diagnose Task 3C). Each memory layer is
 * classified mandatory (plot, timeline, rules) or soft (current chapter,
 * band summary, prior chapter summaries, pins). The total is then enforced
 * against `DEFAULT_PROMPT_BUDGET_CHARS` (18 KB ≈ 4.5K tokens) by
 * largest-first truncation of soft layers. Plot-state and timeline are
 * NEVER trimmed (authoritative per storyMemory.ts synapse).
 */

export type StoryMemoryInput = {
  plotState?: StoryPlotState | null;
  timeline?: StoryTimeline | null;
  pinnedNotes?: StoryPin[];
  bandSummary?: string | null;
  priorChapterSummaries?: string | null;
  rollingSummary?: string | null;
  chapterTitle?: string | null;
  phaseHint?: string | null;
  chapterIndex?: number;
  closedChapterCount?: number;
  /** Optional override for the total prompt budget. Defaults to ~18 KB. */
  budgetChars?: number;
  /** Phase 7.3: reflection layer (Diagnose Task 2B). Optional. */
  reflections?: ReflectionsContainer | null;
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

function buildCurrentChapterSection(input: StoryMemoryInput): string | null {
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
  if (!currentParts.length) return null;
  return currentParts.join("\n\n");
}

function buildBandSummarySection(input: StoryMemoryInput): string | null {
  const band = input.bandSummary?.trim();
  const prior = input.priorChapterSummaries?.trim();
  if (band) return band;
  if (prior) return prior;
  return null;
}

export interface StoryMemoryBuildResult {
  /** Final sections, in prompt order. Includes rules at the end. */
  sections: string[];
  /** Budget report (for observability / Memory-Inspector Page). */
  budget: BudgetPlan;
}

export function buildStoryMemorySections(
  input: StoryMemoryInput,
): string[] {
  return buildStoryMemorySectionsDetailed(input).sections;
}

/**
 * Same as `buildStoryMemorySections` but also returns the budget report —
 * useful for the Memory-Inspector page and the validation toast.
 */
export function buildStoryMemorySectionsDetailed(
  input: StoryMemoryInput,
): StoryMemoryBuildResult {
  const progressSection = buildProgressSection(input);
  const currentChapterSection = buildCurrentChapterSection(input);
  const bandSummary = buildBandSummarySection(input);
  const priorChapterSummaries = input.priorChapterSummaries ?? null;
  const pinnedNotes = input.pinnedNotes ?? [];

  const layers = buildMemoryLayers({
    rules: MEMORY_RULES,
    plotState: input.plotState ?? null,
    timeline: input.timeline ?? null,
    formatPlotState: formatPlotStateForPrompt,
    formatTimeline: formatTimelineForPrompt,
    formatPins: formatPinsForPrompt,
    progressSection,
    bandSummary,
    priorChapterSummaries,
    currentChapterSection,
    pinnedNotes,
  });

  // Phase 7.3: inject the reflection layer BEFORE plot state. The reflection
  // is a high-level "what's true now" snapshot that helps the LLM hold the
  // forest (relationships, open questions, key facts) in mind even when the
  // recent turns are noisy. Treated as soft (can be dropped under tight
  // budget), but in practice it's tiny (~1 KB) so usually kept.
  const reflectionText = input.reflections
    ? formatReflectionsForPrompt(input.reflections, { useLatest: true })
    : null;
  if (reflectionText) {
    layers.unshift({
      name: "reflection",
      text: reflectionText,
      mandatory: false,
      chars: reflectionText.length,
    });
  }

  // Add the rules layer (always last, mandatory).
  layers.push({
    name: "rules",
    text: MEMORY_RULES,
    mandatory: true,
    chars: MEMORY_RULES.length,
  });

  const budget = enforcePromptBudget(
    layers,
    input.budgetChars ?? DEFAULT_PROMPT_BUDGET_CHARS,
  );

  const sections = budget.kept
    .map((l) => l.text)
    .filter((t): t is string => !!t);

  return { sections, budget };
}
