/**
 * Phase 7.2: Hierarchical summarization — chapter chunks.
 *
 * Diagnose-Befund (docs/ENGINE-DIAGNOSIS-2026-06-30.md, Defekt 1):
 *   Rolling-Summary wird bei jedem Sync komplett neu aus 40 KB Transcript
 *   generiert. Nach 100 Turns verliert der Summary ältere Fakten, weil das
 *   LLM nicht alle Details behalten kann. Symptom: "Kaelen ist verletzt"
 *   war in Turn 30, geht in Turn 80 verloren.
 *
 * Lösung: Statt 40 KB Transcript in den Prompt zu werfen, fassen wir die
 * letzten ~10 Turns zu einem **Chunk-Summary** (~50-80 Wörter) zusammen und
 * speichern Chunks append-only in `chapters.chapter_chunks` (JSONB).
 * Der Rolling-Summary nutzt dann die letzten 2-3 Chunks als Grundlage
 * (≈ 200 Wörter) — der LLM-Call sieht nur das, was er zusammenfassen muss,
 * und der volle Detail bleibt in den Chunks.
 *
 * Trade-off: 1 zusätzlicher kleiner LLM-Call pro Sync (Chunk-Summary)
 * + der Rolling-Summary-Call sieht jetzt ~200 Wörter statt 40 KB.
 * Net: gleiche Token-Kosten für Rolling-Summary, **besserer Detail-Erhalt**,
 * + Chapter-Summary kann effizient aus N Chunks zusammengebaut werden.
 *
 * Back-Compat: Wenn `chapter_chunks` Spalte fehlt (Pre-Migration 018),
 * funktioniert alles über den alten Pfad. `parseChapterChunks` gibt dann
 * einfach ein leeres Array zurück, `appendChapterChunk` wird zum No-Op.
 */

import type { ChapterRow } from "@/lib/db/stories";

/** Number of turns per chunk. Tune to keep each chunk-summary ~50-80 words. */
export const CHUNK_SIZE = 10;

/** Maximum chunks retained per chapter. Older chunks get dropped. */
export const MAX_CHUNKS_PER_CHAPTER = 20;

export interface ChapterChunk {
  /** Inclusive turn id / index of the chunk's first turn. */
  startTurnIndex: number;
  /** Inclusive turn id / index of the chunk's last turn. */
  endTurnIndex: number;
  /** LLM-generated summary of these turns, 50-80 words target. */
  summary: string;
  /** ISO timestamp when the chunk was generated. */
  generatedAt: string;
}

export const EMPTY_CHUNKS: ChapterChunk[] = [];

/**
 * Parse the `chapter_chunks` column. Tolerates null / wrong shapes /
 * legacy data (pre-Migration 018 → empty array). This is the canonical
 * Back-Compat-Envelope-Pattern from `plotState.ts` & `storyTimeline.ts`.
 */
export function parseChapterChunks(raw: unknown): ChapterChunk[] {
  if (!raw || typeof raw !== "object") return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .filter((c): c is ChapterChunk =>
      !!c && typeof c === "object" &&
      typeof (c as ChapterChunk).summary === "string" &&
      typeof (c as ChapterChunk).startTurnIndex === "number" &&
      typeof (c as ChapterChunk).endTurnIndex === "number",
    )
    .map((c) => ({
      startTurnIndex: Math.max(0, Math.floor(c.startTurnIndex)),
      endTurnIndex: Math.max(0, Math.floor(c.endTurnIndex)),
      summary: c.summary.trim().slice(0, 1500), // hard cap on length
      generatedAt: typeof c.generatedAt === "string" ? c.generatedAt : new Date().toISOString(),
    }))
    .filter((c) => c.summary.length > 0);
}

/**
 * Given a chapter's chunks and the next turn index to summarize, decide
 * whether a new chunk should be appended. Returns the turn range to
 * summarize, or null if no new chunk is needed yet.
 *
 * Heuristic: append when the gap since the last chunk's endTurnIndex is
 * >= CHUNK_SIZE. This keeps chunks roughly equal-sized and avoids
 * chunk-explosion at every single-turn sync.
 */
export function nextChunkRange(
  chunks: ChapterChunk[],
  currentTurnIndex: number,
): { start: number; end: number } | null {
  if (currentTurnIndex < 0) return null;
  const lastEnd = chunks.length > 0
    ? Math.max(...chunks.map((c) => c.endTurnIndex))
    : -1;
  const gap = currentTurnIndex - lastEnd;
  if (gap < CHUNK_SIZE) return null;
  // Round the start down to the nearest CHUNK_SIZE boundary so chunks
  // are evenly sized (10, 10, 10, not 7, 10, 10).
  const start = lastEnd < 0
    ? Math.max(0, currentTurnIndex - CHUNK_SIZE + 1)
    : lastEnd + 1;
  return { start, end: currentTurnIndex };
}

/**
 * Append a new chunk to the existing list. Caps at MAX_CHUNKS_PER_CHAPTER
 * to avoid unbounded growth (older chunks fall off the front).
 */
export function appendChapterChunk(
  chunks: ChapterChunk[],
  next: ChapterChunk,
): ChapterChunk[] {
  const merged = [...chunks, next];
  if (merged.length > MAX_CHUNKS_PER_CHAPTER) {
    return merged.slice(merged.length - MAX_CHUNKS_PER_CHAPTER);
  }
  return merged;
}

/**
 * Compose the chunks into a single "chapter so far" summary string, ready
 * to be injected into prompts. Output is chronological, oldest first, with
 * turn range headers. Total target: 1-2 KB for a full chapter.
 */
export function formatChunksForPrompt(
  chunks: ChapterChunk[],
  opts: { maxChunks?: number } = {},
): string | null {
  if (!chunks.length) return null;
  const { maxChunks = MAX_CHUNKS_PER_CHAPTER } = opts;
  const picked = chunks.slice(-maxChunks);
  const lines: string[] = [
    "## Chapter chunks (oldest → newest — last entry is most recent)",
  ];
  for (const c of picked) {
    lines.push(`- **Turns ${c.startTurnIndex}–${c.endTurnIndex}:** ${c.summary}`);
  }
  return lines.join("\n");
}

/**
 * Compose the chunks into a single narrative summary for the chapter
 * summary column. Used by `finalizeChapter` to assemble the closing
 * summary from accumulated chunks rather than a one-shot LLM call.
 */
export function composeChapterSummaryFromChunks(chunks: ChapterChunk[]): string {
  if (!chunks.length) return "";
  return chunks
    .map((c) => `**Turns ${c.startTurnIndex}–${c.endTurnIndex}:** ${c.summary}`)
    .join("\n\n");
}

/**
 * Convenience: pull parsed chunks from a chapter row, with empty fallback.
 */
export function getChapterChunks(chapter: Pick<ChapterRow, "id"> & { chapter_chunks?: unknown } | null | undefined): ChapterChunk[] {
  if (!chapter) return EMPTY_CHUNKS;
  // The `chapter_chunks` column may not exist on legacy rows — the cast
  // is `unknown` to keep this lib usable before migration 018 is applied.
  return parseChapterChunks((chapter as { chapter_chunks?: unknown }).chapter_chunks);
}
