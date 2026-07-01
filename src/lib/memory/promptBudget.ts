/**
 * Phase 7.3: Smart-Prompt-Budget (Diagnose Task 3C).
 *
 * Diagnose-Befund (docs/ENGINE-DIAGNOSIS-2026-06-30.md, Defekt 6 / Kontext-Rot):
 *   Wir geben ALLES in den Prompt → 60-100 KB bei langen Storys, das ist in
 *   der "rot zone" für viele Modelle. Mehr Context ≠ bessere Antwort.
 *
 * Lösung: Pro Memory-Layer ein weiches Token-Budget. Plot-State und Timeline
 * sind authoritative und werden NIEMALS getrimmt. Soft-Layer (Pins, Band-
 * Summary, Rolling-Summary, Prior-Chapter-Summaries) werden largest-first
 * truncated, bis die Summe unter dem User-Config-Budget liegt.
 *
 * Heuristik: 1 Token ≈ 4 Zeichen (Englisch/Deutsch Mittel). Wir messen in
 * Zeichen und rechnen am Ende in geschätzte Tokens — gut genug für
 * Budget-Entscheidungen, ohne einen Tokenizer mitzuziehen.
 *
 * User-Tunable: DEFAULT_PROMPT_BUDGET_CHARS und MAX_* in StorySettings
 * (optional, später via /settings).
 */

import type { StoryPin } from "@/lib/memory/storyPins";
import type { StoryPlotState } from "@/lib/memory/plotState";
import type { StoryTimeline } from "@/lib/memory/storyTimeline";

/** Default total budget for the story-memory section of the system prompt. */
export const DEFAULT_PROMPT_BUDGET_CHARS = 18_000;

/** Approximation: 1 token ≈ 4 chars (EN/DE average). Used for reporting only. */
export const CHARS_PER_TOKEN_ESTIMATE = 4;

/** Hard ceiling for any single soft-layer (defends against runaway band-summaries). */
const MAX_SOFT_LAYER_CHARS = 10_000;

/** Priority order. Plot-state and timeline are NEVER trimmed (authoritative). */
export const LAYER_PRIORITY = [
  "rules", // 0 — can't be trimmed (synapse)
  "reflection", // 1 — high-priority soft layer (Diagnose Task 2B)
  "plot", // 2 — can't be trimmed (authoritative per storyMemory.ts)
  "timeline", // 3 — can't be trimmed (chronological beats)
  "progress", // 4 — small, very rarely trimmed
  "currentChapter", // 5 — soft, can be trimmed
  "bandSummary", // 6 — soft, can be trimmed
  "priorChapterSummaries", // 7 — soft, can be trimmed
  "pins", // 8 — soft, can be trimmed
] as const;

export type LayerName = (typeof LAYER_PRIORITY)[number];

export interface LayerContent {
  name: LayerName;
  /** Pre-rendered section text (with header etc). null = no content. */
  text: string | null;
  /** Whether this layer is mandatory (never trimmed). */
  mandatory: boolean;
  /** Original char-count of `text`. 0 if text is null. */
  chars: number;
}

export interface BudgetPlan {
  /** Sections kept, in the original priority order. */
  kept: LayerContent[];
  /** Sections dropped (after a soft layer hit its cap). */
  dropped: LayerContent[];
  /** Sections truncated (only their tail was kept). */
  truncated: LayerContent[];
  /** Total chars after budget enforcement. */
  totalChars: number;
  /** Total chars before budget enforcement (sum of all input layers). */
  inputChars: number;
  /** Estimated tokens after budget. */
  estimatedTokens: number;
  /** True when the budget actually changed something. */
  changed: boolean;
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Truncate a section's text to `maxChars`, preferring to cut at a sentence
 * boundary (period, newline) near the cap. Falls back to a hard cut.
 */
function truncateToChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cap = Math.max(80, maxChars - 30); // leave room for "[…truncated]" marker
  // Find a sentence boundary near the cap
  const window = text.slice(0, cap);
  const lastPeriod = Math.max(
    window.lastIndexOf("\n\n"),
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (lastPeriod > cap * 0.5) {
    return text.slice(0, lastPeriod + 1) + " […]";
  }
  return text.slice(0, cap) + " […]";
}

/**
 * Enforce a soft token-budget on a list of story-memory layers.
 *
 * Rules:
 * - Mandatory layers (rules, plot, timeline) are NEVER trimmed or dropped.
 * - Soft layers (currentChapter, bandSummary, priorChapterSummaries, pins)
 *   are first individually capped at MAX_SOFT_LAYER_CHARS (largest-first
 *   truncation), then the total is reduced by dropping the lowest-priority
 *   soft layers one by one until we're under `budgetChars`.
 * - The `progress` layer is small and treated as semi-mandatory: it is
 *   only dropped as a last resort.
 *
 * Returns a `BudgetPlan` with the kept/truncated/dropped layers and a
 * cost report. Caller (buildStoryMemorySections) renders `kept` in
 * priority order.
 */
export function enforcePromptBudget(
  layers: LayerContent[],
  budgetChars: number = DEFAULT_PROMPT_BUDGET_CHARS,
): BudgetPlan {
  const inputChars = layers.reduce((s, l) => s + l.chars, 0);

  // Step 1: cap each soft layer at MAX_SOFT_LAYER_CHARS.
  const capped: LayerContent[] = layers.map((l) => {
    if (l.mandatory || !l.text) return l;
    if (l.chars <= MAX_SOFT_LAYER_CHARS) return l;
    return {
      ...l,
      text: truncateToChars(l.text, MAX_SOFT_LAYER_CHARS),
      chars: Math.min(l.chars, MAX_SOFT_LAYER_CHARS),
    };
  });

  const truncated = capped
    .map((c, i) => ({ c, original: layers[i] }))
    .filter(({ c, original }) => c.text !== original.text)
    .map(({ c }) => c);

  // Step 2: drop soft layers in reverse priority order until under budget.
  // mandatory layers are protected. progress is dropped last.
  const order = [...capped].sort((a, b) => {
    const ai = LAYER_PRIORITY.indexOf(a.name);
    const bi = LAYER_PRIORITY.indexOf(b.name);
    return bi - ai; // higher priority first (lower index = higher priority)
  });

  const dropped: LayerContent[] = [];
  const total = () => capped
    .filter((l) => !dropped.includes(l))
    .reduce((s, l) => s + l.chars, 0);

  // Sort by priority ASC (lowest priority = highest index in LAYER_PRIORITY)
  // Drop lowest priority soft layers first.
  const softLayersByLowPriority = order
    .filter((l) => !l.mandatory)
    .reverse(); // now lowest priority first

  for (const layer of softLayersByLowPriority) {
    while (total() > budgetChars && capped.includes(layer)) {
      const idx = capped.indexOf(layer);
      const [removed] = capped.splice(idx, 1);
      dropped.push(removed);
    }
    if (total() <= budgetChars) break;
  }

  // Step 3: re-truncate the lowest-priority remaining soft layer if still
  // over budget (this is rare; only when mandatory layers alone exceed it).
  if (total() > budgetChars) {
    // Find a remaining non-mandatory layer to truncate further.
    const softRemaining = capped
      .filter((l) => !l.mandatory && l.text)
      .sort((a, b) => {
        const ai = LAYER_PRIORITY.indexOf(a.name);
        const bi = LAYER_PRIORITY.indexOf(b.name);
        return bi - ai; // lowest priority first
      });
    for (const layer of softRemaining) {
      if (total() <= budgetChars) break;
      const idx = capped.indexOf(layer);
      const overflow = total() - budgetChars;
      const newMax = Math.max(200, layer.chars - overflow - 50);
      capped[idx] = {
        ...layer,
        text: truncateToChars(layer.text!, newMax),
        chars: newMax,
      };
      truncated.push(capped[idx]);
    }
  }

  // Final kept list, sorted by priority.
  const kept = capped
    .filter((l) => !dropped.includes(l))
    .sort((a, b) => {
      const ai = LAYER_PRIORITY.indexOf(a.name);
      const bi = LAYER_PRIORITY.indexOf(b.name);
      return ai - bi;
    });

  const totalChars = kept.reduce((s, l) => s + l.chars, 0);

  return {
    kept,
    dropped,
    truncated: Array.from(new Set(truncated)),
    totalChars,
    inputChars,
    estimatedTokens: estimateTokens(totalChars),
    changed: dropped.length > 0 || truncated.length > 0,
  };
}

/**
 * Convenience: build the layer list from raw memory inputs.
 * Used by buildStoryMemorySections.
 */
export function buildMemoryLayers(input: {
  rules: string;
  plotState: StoryPlotState | null;
  timeline: StoryTimeline | null;
  formatPlotState: (s: StoryPlotState | null) => string | null;
  formatTimeline: (t: StoryTimeline | null) => string | null;
  formatPins: (pins: StoryPin[]) => string | null;
  progressSection: string | null;
  bandSummary: string | null;
  priorChapterSummaries: string | null;
  currentChapterSection: string | null;
  pinnedNotes: StoryPin[];
}): LayerContent[] {
  const layers: LayerContent[] = [];

  const plotText = input.formatPlotState(input.plotState);
  layers.push({
    name: "plot",
    text: plotText,
    mandatory: true,
    chars: plotText?.length ?? 0,
  });

  const timelineText = input.formatTimeline(input.timeline);
  layers.push({
    name: "timeline",
    text: timelineText,
    mandatory: true,
    chars: timelineText?.length ?? 0,
  });

  layers.push({
    name: "progress",
    text: input.progressSection,
    mandatory: false, // small + can be omitted if extreme
    chars: input.progressSection?.length ?? 0,
  });

  const currentChapterText = input.currentChapterSection
    ? `## Current chapter (compressed memory — check recent messages if unsure)\n${input.currentChapterSection}`
    : null;
  layers.push({
    name: "currentChapter",
    text: currentChapterText,
    mandatory: false,
    chars: currentChapterText?.length ?? 0,
  });

  const bandText =
    input.bandSummary?.trim()
      ? `## Earlier story (closed chapters)\n${input.bandSummary.trim()}`
      : input.priorChapterSummaries?.trim()
        ? `## Earlier story (closed chapters)\n${input.priorChapterSummaries.trim()}`
        : null;
  layers.push({
    name: "bandSummary",
    text: bandText,
    mandatory: false,
    chars: bandText?.length ?? 0,
  });

  const pinsText = input.formatPins(input.pinnedNotes);
  layers.push({
    name: "pins",
    text: pinsText,
    mandatory: false,
    chars: pinsText?.length ?? 0,
  });

  return layers;
}
