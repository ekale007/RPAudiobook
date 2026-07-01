import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { ChatTurn, OpenRouterSettings } from "@/lib/types";
import type { ChapterChunk } from "@/lib/memory/chapterChunks";
import { formatChunksForPrompt } from "@/lib/memory/chapterChunks";

/**
 * Phase 7.2: Hierarchical rolling summary.
 *
 * Diagnose-Befund (docs/ENGINE-DIAGNOSIS-2026-06-30.md, Defekt 1):
 *   Rolling-Summary wird bei jedem Sync komplett neu aus 40 KB Transcript
 *   generiert. Nach 50 Turns verliert der Summary ältere Fakten.
 *
 * Lösung: Statt 40 KB Transcript in den Prompt zu werfen, nutzen wir
 * die letzten 2-3 ChapterChunks (~150-250 Wörter) als Grundlage plus
 * den letzten **chunk_recent_turns** (Default: 6) Roh-Turns für
 * frische Details. Das hält den Summary-Call klein und fokussiert.
 *
 * Fallback: Wenn keine Chunks vorhanden sind (pre-Migration 018 oder
 * sehr junges Kapitel), funktioniert der alte Pfad — die letzten 40 KB
 * Transcript werden wie bisher zusammengefasst. Das ist exakt das
 * Verhalten vor Phase 7.2.
 */

const CHUNK_RECENT_TURNS = 6; // fresh turns not yet covered by the last chunk
const CHUNK_TRANSCRIPT_FALLBACK_CHARS = 40000;

function formatTurnForSummary(t: ChatTurn): string {
  if (t.role === "system") return "";
  const who =
    t.speakerSlug && t.speakerSlug !== "narrator"
      ? `${t.role.toUpperCase()} (${t.speakerSlug})`
      : t.role.toUpperCase();
  return `${who}: ${t.content}`;
}

function buildTranscript(turns: ChatTurn[], maxChars = CHUNK_TRANSCRIPT_FALLBACK_CHARS): string {
  const lines = turns
    .filter((t) => t.role !== "system")
    .map(formatTurnForSummary)
    .filter(Boolean);
  const full = lines.join("\n\n");
  if (full.length <= maxChars) return full;
  return `[Earlier lines omitted — ${lines.length} turns total. Summary must match the END of the transcript.]\n\n${full.slice(-maxChars)}`;
}

export interface RegenerateRollingSummaryOpts {
  chapterTitle?: string | null;
  phaseHint?: string | null;
  /**
   * Phase 7.2: existing chapter chunks. If provided AND non-empty, the
   * summary is generated from the last chunks + recent fresh turns
   * (hierarchical path). If empty/undefined, falls back to the
   * single-pass 40KB-transcript path.
   */
  existingChunks?: ChapterChunk[];
}

/**
 * Rebuild chapter rolling memory from the full transcript (not incremental merge).
 * Reduces "jumping back" after rewind/reroll or drift from partial updates.
 *
 * Phase 7.2: if `existingChunks` is supplied, use the hierarchical path
 * (chunks + recent turns). Otherwise use the legacy 40KB single-pass path.
 */
export async function regenerateRollingSummary(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  opts?: RegenerateRollingSummaryOpts,
): Promise<string> {
  if (!turns.some((t) => t.role !== "system")) {
    return "";
  }

  const chapterTitle = opts?.chapterTitle ?? null;
  const phaseHint = opts?.phaseHint ?? null;
  const chunks = opts?.existingChunks ?? [];

  // ---- Hierarchical path (Phase 7.2) ----
  if (chunks.length > 0) {
    const lastChunkEnd = Math.max(...chunks.map((c) => c.endTurnIndex));
    // Cover the turns that have happened AFTER the last chunk was finalized.
    // ChatTurn carries `index_in_chapter` indirectly via DB ordering; we
    // approximate by using the array position from the END of the transcript
    // (recent turns are at the end of `turns`).
    const recentTurns = turns.slice(-CHUNK_RECENT_TURNS);
    // Recompute start/end indices in chapter-turn coordinates. We use the
    // lastChunkEnd as the anchor and grow backward.
    const startOfRecent = Math.max(0, lastChunkEnd - (recentTurns.length - 1));
    const endOfRecent = lastChunkEnd + recentTurns.length;
    const recentTranscript = buildTranscript(recentTurns, 6000);
    const chunksBlock = formatChunksForPrompt(chunks.slice(-3), { maxChunks: 3 });
    const header = [
      chapterTitle ? `Chapter: ${chapterTitle}` : null,
      phaseHint ? `Author timeline hint: ${phaseHint}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const messages = [
      {
        role: "system",
        content: `You maintain story memory for an interactive RPG chapter.

Below is a HIERARCHICAL memory view: previous chapter chunks (older narrative)
+ the most recent few turns (fresh detail not yet chunked). Write an updated
in-chapter memory (200–280 words) using this exact structure:

## Story state
- Time / countdown: (concrete; e.g. "≈34 hours until fleet arrival" — use the latest evidence)
- Location:
- Who is present (physically in scene now):
- Who is absent (left, elsewhere, meeting later):
- Immediate situation:

## What happened
Chronological prose of key events, player ("you") actions, dialogue beats, and open threads. Use the chunks for older context, the recent turns for fresh detail. Do not lose facts from the chunks.

Rules:
- Use ONLY facts from the chunks and the recent transcript.
- The END of the recent transcript is the latest time — do not revert to earlier countdowns or locations.
- If a character left the scene or agreed to meet later, note they are **absent**.
- If a threat was defeated or cancelled, say so explicitly; do NOT keep an active invasion countdown.
- If countdown appears multiple times, use the **most recent** mention only while the threat is still active.
- Plain English, no bullet lists except the five "Story state" lines above.`,
      },
      {
        role: "user",
        content: [
          header ? `${header}\n` : "",
          `\nPrevious chapter chunks (oldest → newest):\n${chunksBlock ?? "(none)"}`,
          `\nRecent turns (${recentTurns.length}, turns ${startOfRecent}–${endOfRecent}):\n${recentTranscript}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
    return completeOpenRouter(settings, messages, {
      maxTokens: 900,
      temperature: 0.25,
    });
  }

  // ---- Legacy single-pass path (kept for back-compat) ----
  const transcript = buildTranscript(turns);
  const header = [
    chapterTitle ? `Chapter: ${chapterTitle}` : null,
    phaseHint ? `Author timeline hint: ${phaseHint}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const messages = [
    {
      role: "system",
      content: `You maintain story memory for an interactive RPG chapter.

From the FULL transcript below, write an updated in-chapter memory (200–280 words) in this exact structure:

## Story state
- Time / countdown: (concrete; e.g. "≈34 hours until fleet arrival" or "morning, day 1, ~10 minutes after she left" — use the latest evidence in the transcript)
- Location:
- Who is present (physically in scene now):
- Who is absent (left, elsewhere, meeting later):
- Immediate situation:

## What happened
Chronological prose of key events, player ("you") actions, dialogue beats, and open threads.

Rules:
- Use ONLY facts from the transcript.
- The END of the transcript is the latest time — do not revert to earlier countdowns or locations.
- If a character left the scene or agreed to meet later, note they are **absent** — do not list them as present.
- Track scheduled future meetings explicitly when characters arrange them.
- If a threat was defeated or cancelled, say so explicitly; do NOT keep an active invasion countdown.
- If countdown appears multiple times, use the **most recent** mention only while the threat is still active.
- Plain English, no bullet lists except the five "Story state" lines above.`,
    },
    {
      role: "user",
      content: `${header ? `${header}\n\n` : ""}Transcript:\n${transcript}`,
    },
  ];

  return completeOpenRouter(settings, messages, {
    maxTokens: 900,
    temperature: 0.25,
  });
}
