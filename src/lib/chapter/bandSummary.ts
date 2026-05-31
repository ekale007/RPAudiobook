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
