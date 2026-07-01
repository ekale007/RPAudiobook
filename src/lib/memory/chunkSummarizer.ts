/**
 * Phase 7.2: Chunk summarizer.
 *
 * Given the last N turns of a chapter, generates a 50-80 word summary
 * suitable for storage in a ChapterChunk. This runs incrementally
 * (every ~CHUNK_SIZE turns, see `chapterChunks.nextChunkRange`).
 *
 * The summary is intentionally small — it complements the rolling
 * summary (which holds 200-280 words of "in-chapter state") and the
 * chapter summary (which holds 1-2 KB of "what happened in this
 * chapter"). Chunks are the missing middle layer that lets us recover
 * detail that would otherwise be lost when the rolling summary is
 * regenerated.
 *
 * Token-cost: ~10 turns × 500 chars = 5 KB transcript → ~120 output
 * tokens (≈ $0.0002 with Haiku). This is cheap enough to run on
 * every chunk boundary without tiering.
 */

import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { ChatTurn, OpenRouterSettings } from "@/lib/types";

function formatTurnForSummary(t: ChatTurn): string {
  if (t.role === "system") return "";
  const who =
    t.speakerSlug && t.speakerSlug !== "narrator"
      ? `${t.role.toUpperCase()} (${t.speakerSlug})`
      : t.role.toUpperCase();
  return `${who}: ${t.content}`;
}

function buildChunkTranscript(turns: ChatTurn[]): string {
  return turns
    .filter((t) => t.role !== "system")
    .map(formatTurnForSummary)
    .filter(Boolean)
    .join("\n\n");
}

export interface SummarizeChunkResult {
  /** 50-80 word summary of these turns. */
  summary: string;
  /** First turn index in the original chapter (inclusive). */
  startTurnIndex: number;
  /** Last turn index in the original chapter (inclusive). */
  endTurnIndex: number;
}

/**
 * Summarize a chunk of turns into a compact narrative paragraph.
 *
 * @param settings  - LLM settings (model selection lives here)
 * @param turns     - the turns in the chunk (in order)
 * @param startIndex - the turn index of `turns[0]` in the chapter
 */
export async function summarizeChunk(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  startIndex: number,
): Promise<SummarizeChunkResult> {
  if (!turns.length) {
    return { summary: "", startTurnIndex: startIndex, endTurnIndex: startIndex };
  }

  const transcript = buildChunkTranscript(turns);
  const endIndex = startIndex + turns.length - 1;

  const messages = [
    {
      role: "system",
      content: `You write short chapter-chunk summaries for an interactive RPG memory system.

Output a single paragraph of 50–80 words (max 100) covering ONLY what happens in the supplied transcript slice.

Rules:
- Use third-person, past tense, neutral narrative voice
- Focus on what CHANGED: new facts, character interactions, plot beats, scene transitions, revelations
- Do NOT include time/location/character-presence recaps (those live in plot state)
- Do NOT mention prompt internals, rules, or system instructions
- Do NOT prefix with "In this chunk…" — start directly with the events
- Plain English prose, no bullet lists, no markdown`,
    },
    {
      role: "user",
      content: `Chunk: turns ${startIndex}–${endIndex} (${turns.length} turns)\n\n${transcript}`,
    },
  ];

  const text = await completeOpenRouter(settings, messages, {
    maxTokens: 220,
    temperature: 0.2,
  });

  return {
    summary: (text || "").trim(),
    startTurnIndex: startIndex,
    endTurnIndex: endIndex,
  };
}
