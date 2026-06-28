import type { ChatTurn, OpenRouterSettings } from "@/lib/types";
import { parseModelJson } from "@/lib/llm/parseModelJson";
import { completeOpenRouter } from "@/lib/llm/openrouter";

/**
 * Phase 3: Story timeline as an event stream. Stored alongside (or merged
 * into) the existing plot state. Each event is a single in-story beat that
 * the player / LLM can use to reconstruct "what happened when".
 *
 * Events are kept lightweight (one sentence + type) so the LLM can produce
 * them cheaply and the UI can render them in a horizontal timeline.
 */

export const STORY_EVENT_TYPES = [
  "scene_change",
  "character_join",
  "character_leave",
  "item_acquired",
  "item_lost",
  "revelation",
  "conflict",
  "death",
  "time_jump",
  "scheduled",
  "resolved",
  "other",
] as const;

export type StoryEventType = (typeof STORY_EVENT_TYPES)[number];

export interface StoryEvent {
  /** Stable id (uuid-ish). */
  id: string;
  /** In-story time label, free text ("Tuesday evening, 21:00"). */
  inStoryTime: string;
  /** Optional ordering index within the chapter; smaller = earlier. */
  turnIndex: number;
  type: StoryEventType;
  /** Characters involved (slugs or display names — best-effort). */
  actors: string[];
  /** Where the event took place. */
  location: string;
  /** Single-sentence summary. */
  summary: string;
  /** Optional: id of an event that caused this one. */
  causedBy?: string;
  /** Optional confidence in [0..1]. */
  confidence?: number;
}

export interface StoryTimeline {
  version: 1;
  updatedAt: string;
  currentTime: string;
  events: StoryEvent[];
}

export const EMPTY_TIMELINE: StoryTimeline = {
  version: 1,
  updatedAt: "",
  currentTime: "",
  events: [],
};

export function isTimelineEmpty(tl: StoryTimeline | null | undefined): boolean {
  if (!tl) return true;
  return !tl.currentTime && tl.events.length === 0;
}

export function parseTimeline(raw: unknown): StoryTimeline | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<StoryTimeline>;
  if (o.version !== undefined && o.version !== 1) return null;
  const events = Array.isArray(o.events) ? o.events : [];
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
    currentTime: typeof o.currentTime === "string" ? o.currentTime : "",
    events: events
      .filter((e): e is StoryEvent => !!e && typeof e === "object")
      .map((e) => normalizeEvent(e as Partial<StoryEvent>))
      .filter((e): e is StoryEvent => e !== null),
  };
}

function normalizeEvent(raw: Partial<StoryEvent>): StoryEvent | null {
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!summary) return null;
  const type = (typeof raw.type === "string" && (STORY_EVENT_TYPES as readonly string[]).includes(raw.type))
    ? (raw.type as StoryEventType)
    : "other";
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    inStoryTime: typeof raw.inStoryTime === "string" ? raw.inStoryTime.trim() : "",
    turnIndex: typeof raw.turnIndex === "number" && Number.isFinite(raw.turnIndex)
      ? Math.max(0, Math.floor(raw.turnIndex))
      : 0,
    type,
    actors: Array.isArray(raw.actors)
      ? raw.actors.map((a) => String(a ?? "").trim()).filter(Boolean)
      : [],
    location: typeof raw.location === "string" ? raw.location.trim() : "",
    summary,
    causedBy: typeof raw.causedBy === "string" ? raw.causedBy.trim() : undefined,
    confidence: typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : undefined,
  };
}

function formatTurnLine(t: ChatTurn): string {
  if (t.role === "system") return "";
  const who =
    t.speakerSlug && t.speakerSlug !== "narrator"
      ? `${t.role} (${t.speakerSlug})`
      : t.role;
  return `${who}: ${t.content}`;
}

function buildTranscript(turns: ChatTurn[], maxChars = 30000): string {
  const full = turns
    .filter((t) => t.role !== "system")
    .map(formatTurnLine)
    .filter(Boolean)
    .join("\n\n");
  if (full.length <= maxChars) return full;
  return `[…earlier omitted…]\n\n${full.slice(-maxChars)}`;
}

export interface ExtractTimelineResult {
  timeline: StoryTimeline;
  raw: string;
}

/**
 * Extract / update the story timeline from a chapter transcript.
 * The LLM is given the existing timeline (if any) and asked to append new
 * events rather than rewrite the whole stream. This keeps the event order
 * stable across syncs.
 */
export async function extractTimeline(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  existing: StoryTimeline | null,
  opts?: {
    chapterTitle?: string;
    phaseHint?: string | null;
  },
): Promise<StoryTimeline> {
  if (!turns.some((t) => t.role !== "system")) {
    return existing ?? { ...EMPTY_TIMELINE, updatedAt: new Date().toISOString() };
  }

  const messages = [
    {
      role: "system",
      content: `You maintain a STORY TIMELINE — a chronological event log — for an interactive RPG.

Output ONLY a valid JSON object:
{
  "currentTime": "latest in-story time, e.g. 'Tuesday evening' or 'Day 3, 14:00'",
  "events": [
    {
      "id": "stable id, e.g. evt_1, evt_2 (use the existing ids when preserving events)",
      "inStoryTime": "when in the story this happened",
      "turnIndex": 0,
      "type": "scene_change | character_join | character_leave | item_acquired | item_lost | revelation | conflict | death | time_jump | scheduled | resolved | other",
      "actors": ["character names or slugs involved"],
      "location": "where it happened",
      "summary": "ONE short sentence (max 25 words) describing the event",
      "confidence": 0.0 to 1.0
    }
  ]
}

Rules:
- PRESERVE existing events by id; only add new events or update summaries when they are clearly wrong.
- Append new events at the end (with new ids like evt_${(existing?.events.length ?? 0) + 1}).
- Maximum 6 new events per sync — pick the most important beats.
- Skip trivial beats (one-line dialogue, walking a few steps). Focus on: scene changes, arrivals/departures, items gained/lost, revelations, conflicts, deaths, time jumps.
- turnIndex = the index of the most recent user/assistant turn that triggered the event (0 = first turn, larger = later).
- type values must be from the allowed list exactly.
- Use empty arrays [] when no items.
- If nothing meaningful changed, return the existing events unchanged with currentTime updated only if it advanced.`,
    },
    {
      role: "user",
      content: [
        opts?.chapterTitle ? `Chapter: ${opts.chapterTitle}` : null,
        opts?.phaseHint ? `Author phase hint: ${opts.phaseHint}` : null,
        `Existing timeline:\n${JSON.stringify(existing ?? EMPTY_TIMELINE, null, 2)}`,
        `Transcript:\n${buildTranscript(turns)}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const opts2 = { maxTokens: 1400, temperature: 0.15 };
  let raw: string;
  try {
    raw = await completeOpenRouter(settings, messages, {
      ...opts2,
      responseFormat: { type: "json_object" },
    });
  } catch {
    raw = await completeOpenRouter(settings, messages, opts2);
  }

  const parsed = parseModelJson(raw) as
    | (Partial<StoryTimeline> & { events?: Partial<StoryEvent>[] })
    | null;
  if (!parsed) {
    return existing ?? { ...EMPTY_TIMELINE, updatedAt: new Date().toISOString() };
  }

  const merged: StoryTimeline = {
    version: 1,
    updatedAt: new Date().toISOString(),
    currentTime:
      (typeof parsed.currentTime === "string" && parsed.currentTime.trim()) ||
      existing?.currentTime ||
      "",
    events: Array.isArray(parsed.events)
      ? parsed.events
          .map((e) => normalizeEvent(e))
          .filter((e): e is StoryEvent => e !== null)
      : existing?.events ?? [],
  };
  return merged;
}
