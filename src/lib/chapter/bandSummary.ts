import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { ChapterRow } from "@/lib/db/stories";
import type { OpenRouterSettings } from "@/lib/types";

/** Above this size, compress closed-chapter memory before injecting into prompts. */
export const BAND_SUMMARY_COMPRESS_THRESHOLD = 10_000;

export function composeBandSummary(chapters: ChapterRow[]): string {
  return chapters
    .filter((c) => c.status === "closed" && c.chapter_summary?.trim())
    .sort((a, b) => a.index_in_band - b.index_in_band)
    .map(
      (c) =>
        `### Chapter ${c.index_in_band}: ${c.title}\n${c.chapter_summary!.trim()}`,
    )
    .join("\n\n");
}

export async function compressBandSummary(
  settings: OpenRouterSettings,
  fullText: string,
  closedChapterCount: number,
): Promise<string> {
  const messages = [
    {
      role: "system",
      content: `You compress long interactive-fiction memory for continuity across many chapters.

Write 450–650 words of plain English prose (no bullet lists) covering ALL ${closedChapterCount} closed chapters in **chronological order**.

Must include:
- Current story timeline (how much in-story time has passed — latest time wins)
- Major plot turns in order, emphasizing the **most recent** chapters
- Player ("you") choices and consequences that still matter
- Relationships, locations, objects, public revelations
- Defeated/cancelled threats — do NOT revive them
- Open hooks at the **end** of the latest chapter

Rules:
- This is memory for continuing the story — never restart from Act I or the opening scenario.
- If early and late events conflict, the **later** chapter is correct.
- Do not invent events.`,
    },
    {
      role: "user",
      content: `Closed chapters (${closedChapterCount}):\n\n${fullText.slice(0, 52000)}`,
    },
  ];

  return completeOpenRouter(settings, messages, {
    maxTokens: 1400,
    temperature: 0.25,
  });
}

export async function buildBandSummaryForStorage(
  chapters: ChapterRow[],
  settings?: OpenRouterSettings | null,
): Promise<string> {
  const raw = composeBandSummary(chapters);
  if (!raw) return "";
  const closedCount = chapters.filter(
    (c) => c.status === "closed" && c.chapter_summary?.trim(),
  ).length;
  if (
    settings &&
    raw.length > BAND_SUMMARY_COMPRESS_THRESHOLD &&
    closedCount >= 3
  ) {
    try {
      return await compressBandSummary(settings, raw, closedCount);
    } catch (e) {
      console.warn("Band summary compression failed, storing raw:", e);
    }
  }
  return raw;
}

/**
 * Phase 7.2: incremental cross-chapter consolidation.
 *
 * Diagnose-Befund (docs/ENGINE-DIAGNOSIS-2026-06-30.md, Defekt 2):
 *   `bandSummary` wird nur beim Chapter-Close komplett neu aus allen
 *   closed-chapter-summaries zusammengebaut. Bei 5+ Kapiteln ist das
 *   entweder zu lang (>10 KB) oder veraltet (LLM vergisst ältere
 *   Details).
 *
 * Lösung: Wenn der bestehende `previousBandSummary` schon kompakt ist
 * (<= BAND_SUMMARY_COMPRESS_THRESHOLD Wörter) UND ein neuer
 * `newChapterSummary` hinzukommt, mergen wir inkrementell:
 *
 *   "Hier ist der bisherige Band-Summary. Hier ist das neue
 *    Chapter-Summary. Schreibe den aktualisierten Band-Summary,
 *    der den neuen Inhalt integriert ohne die älteren Fakten zu
 *    verlieren."
 *
 * Vorteile:
 *   - LLM muss nicht alle closed-chapter-summaries gleichzeitig lesen
 *   - Alter Kontext bleibt erhalten (kein "komplett neu" Risiko)
 *   - Bei jedem Chapter-Close frisch, niemals hoffnungslos veraltet
 *
 * Fallback: Wenn `previousBandSummary` zu groß oder leer ist, wird
 * `buildBandSummaryForStorage` aufgerufen (volle Re-Aggregation).
 *
 * @param previousBandSummary  - was bisher in `bands.band_summary` stand
 * @param newChapterSummary    - der soeben finalisierte chapter_summary
 * @param newChapterTitle      - nur für den System-Prompt
 * @param newChapterIndex      - 1-based chapter index (für Konsolidierungs-Hinweis)
 * @param settings             - LLM settings
 */
export async function consolidateBandSummary(args: {
  previousBandSummary: string | null;
  newChapterSummary: string;
  newChapterTitle: string;
  newChapterIndex: number;
  settings: OpenRouterSettings;
}): Promise<string> {
  const {
    previousBandSummary,
    newChapterSummary,
    newChapterTitle,
    newChapterIndex,
    settings,
  } = args;

  // Fallback path: keine/zu große Vorgabe → volle Re-Aggregation ist
  // sicherer als der inkrementelle Pfad, weil das Modell die ganzen
  // Kapitel-Summaries als Ganzes sieht.
  const previousWords = (previousBandSummary ?? "").trim().split(/\s+/).filter(Boolean).length;
  if (!previousBandSummary || previousWords > 800) {
    // Lade alle chapter-summaries via buildBandSummaryForStorage —
    // rufer-seitig, weil wir hier nur die zwei Inputs haben.
    return previousBandSummary ?? "";
  }

  const messages = [
    {
      role: "system",
      content: `You maintain a cross-chapter story memory for an interactive RPG.

You will be given:
1. The PREVIOUS band summary (a prose memory of all chapters BEFORE the new one).
2. The summary of the NEW chapter that was just closed (Chapter ${newChapterIndex}: "${newChapterTitle}").

Your job: produce an UPDATED band summary that integrates the new chapter into the previous one WITHOUT LOSING older facts. The result should be 450–650 words of plain English prose (no bullet lists, no markdown headers), in chronological order.

Must include:
- Current story timeline (how much in-story time has passed — latest time wins)
- Major plot turns in order, with extra detail for the **most recent** chapters
- Player ("you") choices and consequences that still matter
- Relationships, locations, objects, public revelations
- Defeated/cancelled threats — do NOT revive them
- Open hooks at the **end** of the latest chapter (Chapter ${newChapterIndex})

Rules:
- This is memory for continuing the story — never restart from Act I or the opening scenario.
- If early and late events conflict, the **later** chapter is correct.
- Do not invent events.
- Preserve the open threads / hooks from the previous summary; if the new chapter resolved one, say so explicitly.
- Preserve the threat-status notes (defeated, cancelled) — they are important for the LLM that continues the story next.`,
    },
    {
      role: "user",
      content: `PREVIOUS band summary:\n${previousBandSummary}\n\n---\n\nNEW chapter summary (Chapter ${newChapterIndex}: ${newChapterTitle}):\n${newChapterSummary}`,
    },
  ];

  try {
    return await completeOpenRouter(settings, messages, {
      maxTokens: 1500,
      temperature: 0.2,
    });
  } catch (e) {
    console.warn("Incremental band consolidation failed, falling back to concatenation:", e);
    // Conservative fallback: append the new chapter summary to the previous one.
    return `${previousBandSummary}\n\n### Chapter ${newChapterIndex}: ${newChapterTitle}\n${newChapterSummary}`.trim();
  }
}
