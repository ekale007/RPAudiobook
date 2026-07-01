/**
 * Phase 7.3: Reflection-Layer (Diagnose Task 2B).
 *
 * Diagnose-Befund:
 *   "After 50 turns, the key character relationships are: Kaelen-Lyra
 *    (romance, deepening), Lyra-Marcus (rivalry)..." — the LLM has to
 *    derive this from scattered hints in 50 turns. Reflections make
 *    this explicit so the LLM doesn't lose the forest for the trees.
 *
 * Stanford Generative Agents pattern (arXiv 2304.03442): every N turns,
 * the LLM generates higher-level insights ("reflections") that compress
 * the current state of the story into a few sentences. These are
 * injected into the system prompt BEFORE plot state.
 *
 * Implementation:
 *   - Reflections stored as JSONB in `story_settings.story_reflections`
 *     (added in Migration 019; back-compat: null/empty = no reflections)
 *   - Each reflection is `{ updatedAt, turnIndex, summary, relationships,
 *     openQuestions, keyFacts, currentGoal }` — a structured snapshot
 *   - Generation runs:
 *     (a) incrementally every 30 turns (light), OR
 *     (b) at chapter close (deeper, uses chapter_summary)
 *   - Prompt injection: 1 short paragraph before plot state.
 */

import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { ChatTurn, OpenRouterSettings } from "@/lib/types";

export const REFLECTION_INTERVAL_TURNS = 30;

/** Maximum reflections to retain in the JSONB column. Older ones get dropped. */
export const MAX_REFLECTIONS = 8;

export interface StoryReflection {
  /** ISO timestamp of when the reflection was generated. */
  updatedAt: string;
  /** Turn index at generation time. */
  turnIndex: number;
  /** One-paragraph narrative summary (1-2 sentences, 30-60 words). */
  summary: string;
  /** Key character relationships in the current story, e.g. "Kaelen → Lyra: deepening trust". */
  relationships: string[];
  /** Open questions the player is still wondering about. */
  openQuestions: string[];
  /** Atomic key facts that must NOT be forgotten, e.g. "Kaelen cannot use fire magic". */
  keyFacts: string[];
  /** The player's current apparent goal, e.g. "Reach the capital before the invasion". */
  currentGoal: string;
}

export interface ReflectionsContainer {
  version: 1;
  /** Chronologically ordered, oldest first. */
  reflections: StoryReflection[];
}

export const EMPTY_REFLECTIONS: ReflectionsContainer = {
  version: 1,
  reflections: [],
};

const REFLECTION_SYSTEM = `You maintain a REFLECTION LAYER for an interactive RPG story.

You are given the existing reflection layer (may be empty), a recent transcript slice, and the current plot state. Produce a single updated reflection that captures the **current high-level state** of the story — not the latest turn, but the forest, not the trees.

Output ONLY a JSON object with this exact shape:
{
  "summary": "1-2 sentence narrative of the current state of the story (30-60 words).",
  "relationships": ["<char A> → <char B>: <state>", ...],   // 2-5 entries
  "openQuestions": ["<question the player is wondering>", ...], // 1-3 entries
  "keyFacts": ["<atomic fact the LLM must remember>", ...],   // 1-5 entries
  "currentGoal": "<what the player is trying to do right now, or empty string if unclear>"
}

Rules:
- Use ONLY facts from the transcript + existing reflection. Do not invent.
- If the existing reflection is still accurate, preserve its entries verbatim — only update what changed.
- "relationships" only includes active relationships, not historical ones.
- "keyFacts" should only contain facts that affect future story decisions (e.g. abilities, oaths, secrets, debts, threats). Skip trivial facts.
- "currentGoal" is the player's apparent goal, not the LLM's. Empty string if the player has wandered or the goal is unclear.
- "openQuestions" is what the player is likely wondering. Not what the LLM is wondering.
- If nothing meaningful changed since the existing reflection, return the existing reflection with updatedAt refreshed and the summary refined.`;

function formatTurnLine(t: ChatTurn): string {
  if (t.role === "system") return "";
  const who =
    t.speakerSlug && t.speakerSlug !== "narrator"
      ? `${t.role} (${t.speakerSlug})`
      : t.role;
  return `${who}: ${t.content}`;
}

function buildReflectionTranscript(turns: ChatTurn[], maxChars = 24_000): string {
  const full = turns
    .filter((t) => t.role !== "system")
    .map(formatTurnLine)
    .filter(Boolean)
    .join("\n\n");
  if (full.length <= maxChars) return full;
  return `[...earlier omitted...]\n\n${full.slice(-maxChars)}`;
}

/**
 * Generate an updated reflection from the recent transcript + existing
 * reflection + current plot state. The LLM is asked to preserve the
 * parts of the existing reflection that are still accurate.
 */
export async function generateReflection(args: {
  settings: OpenRouterSettings;
  turns: ChatTurn[];
  existing: StoryReflection | null;
  plotStateSummary: string;
  currentTurnIndex: number;
}): Promise<StoryReflection> {
  const transcript = buildReflectionTranscript(args.turns);
  const user = [
    args.existing
      ? `Existing reflection (preserve what is still accurate):\n${JSON.stringify(args.existing, null, 2)}`
      : "Existing reflection: (none — this is the first one)",
    `Current plot state summary:\n${args.plotStateSummary || "(empty)"}`,
    `Recent transcript (last ${args.turns.length} turns, ending at turn ${args.currentTurnIndex}):\n${transcript}`,
  ].join("\n\n");

  const text = await completeOpenRouter(
    args.settings,
    [
      { role: "system", content: REFLECTION_SYSTEM },
      { role: "user", content: user },
    ],
    { maxTokens: 700, temperature: 0.2, responseFormat: { type: "json_object" } },
  );

  let parsed: Partial<StoryReflection> | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try a forgiving parse: pull the first {...} block.
    const m = /\{[\s\S]*\}/.exec(text);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* fall through */ }
    }
  }
  if (!parsed) {
    // Conservative fallback: keep the existing reflection untouched (just
    // refresh the timestamp and turnIndex). The caller will append.
    if (args.existing) {
      return { ...args.existing, updatedAt: new Date().toISOString(), turnIndex: args.currentTurnIndex };
    }
    return {
      updatedAt: new Date().toISOString(),
      turnIndex: args.currentTurnIndex,
      summary: "",
      relationships: [],
      openQuestions: [],
      keyFacts: [],
      currentGoal: "",
    };
  }

  return {
    updatedAt: new Date().toISOString(),
    turnIndex: args.currentTurnIndex,
    summary: (parsed.summary ?? "").toString().slice(0, 600),
    relationships: Array.isArray(parsed.relationships)
      ? parsed.relationships
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 5)
          .map((s) => s.trim().slice(0, 200))
      : args.existing?.relationships ?? [],
    openQuestions: Array.isArray(parsed.openQuestions)
      ? parsed.openQuestions
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 3)
          .map((s) => s.trim().slice(0, 200))
      : args.existing?.openQuestions ?? [],
    keyFacts: Array.isArray(parsed.keyFacts)
      ? parsed.keyFacts
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 5)
          .map((s) => s.trim().slice(0, 200))
      : args.existing?.keyFacts ?? [],
    currentGoal:
      typeof parsed.currentGoal === "string"
        ? parsed.currentGoal.trim().slice(0, 200)
        : args.existing?.currentGoal ?? "",
  };
}

/** Parse the `story_reflections` column. Back-compat: tolerate null / legacy. */
export function parseReflections(raw: unknown): ReflectionsContainer {
  if (!raw || typeof raw !== "object") return EMPTY_REFLECTIONS;
  const o = raw as Partial<ReflectionsContainer>;
  if (o.version !== undefined && o.version !== 1) return EMPTY_REFLECTIONS;
  const reflections = Array.isArray(o.reflections) ? o.reflections : [];
  return {
    version: 1,
    reflections: reflections
      .filter((r): r is StoryReflection =>
        !!r && typeof r === "object" &&
        typeof (r as StoryReflection).updatedAt === "string" &&
        typeof (r as StoryReflection).turnIndex === "number",
      )
      .map((r) => ({
        updatedAt: r.updatedAt,
        turnIndex: Math.max(0, Math.floor(r.turnIndex)),
        summary: (r.summary ?? "").toString().slice(0, 600),
        relationships: Array.isArray(r.relationships) ? r.relationships.slice(0, 5) : [],
        openQuestions: Array.isArray(r.openQuestions) ? r.openQuestions.slice(0, 3) : [],
        keyFacts: Array.isArray(r.keyFacts) ? r.keyFacts.slice(0, 5) : [],
        currentGoal: (r.currentGoal ?? "").toString().slice(0, 200),
      })),
  };
}

/** Append a new reflection, keep only the most recent MAX_REFLECTIONS. */
export function appendReflection(
  container: ReflectionsContainer,
  next: StoryReflection,
): ReflectionsContainer {
  const merged = [...container.reflections, next];
  const trimmed =
    merged.length > MAX_REFLECTIONS
      ? merged.slice(merged.length - MAX_REFLECTIONS)
      : merged;
  return { version: 1, reflections: trimmed };
}

/** Should we trigger a new reflection given the latest turn index? */
export function shouldGenerateReflection(
  container: ReflectionsContainer,
  currentTurnIndex: number,
  interval: number = REFLECTION_INTERVAL_TURNS,
): boolean {
  if (currentTurnIndex < interval) return false;
  const last =
    container.reflections.length > 0
      ? container.reflections[container.reflections.length - 1]
      : null;
  if (!last) return true;
  return currentTurnIndex - last.turnIndex >= interval;
}

/**
 * Format the latest reflection (or all reflections if asked) for the
 * system prompt. Injected BEFORE the plot state, so the LLM has the
 * high-level summary first.
 */
export function formatReflectionsForPrompt(
  container: ReflectionsContainer,
  opts: { useLatest?: boolean; maxChars?: number } = {},
): string | null {
  if (!container.reflections.length) return null;
  const { useLatest = true, maxChars = 1200 } = opts;
  const r = useLatest
    ? container.reflections[container.reflections.length - 1]
    : null;
  const lines: string[] = [
    "## Reflection (high-level state — what's true *now*, not just the last turn)",
  ];
  if (r) {
    if (r.summary) lines.push("", r.summary);
    if (r.relationships.length) {
      lines.push("", "**Relationships:**");
      for (const s of r.relationships) lines.push(`- ${s}`);
    }
    if (r.openQuestions.length) {
      lines.push("", "**Open questions:**");
      for (const s of r.openQuestions) lines.push(`- ${s}`);
    }
    if (r.keyFacts.length) {
      lines.push("", "**Key facts (must remember):**");
      for (const s of r.keyFacts) lines.push(`- ${s}`);
    }
    if (r.currentGoal) {
      lines.push("", `**Current goal:** ${r.currentGoal}`);
    }
  }
  const text = lines.join("\n");
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}
