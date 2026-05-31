import { completeOpenRouter } from "@/lib/llm/openrouter";
import { regenerateRollingSummary } from "@/lib/chapter/rollingSummary";
import type { ChatTurn, OpenRouterSettings } from "@/lib/types";

function formatTurnForSummary(t: ChatTurn): string {
  if (t.role === "system") return "";
  const who =
    t.speakerSlug && t.speakerSlug !== "narrator"
      ? `${t.role.toUpperCase()} (${t.speakerSlug})`
      : t.role.toUpperCase();
  return `${who}: ${t.content}`;
}

export async function summarizeChapter(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  chapterTitle: string,
): Promise<string> {
  const transcript = turns
    .filter((t) => t.role !== "system")
    .map(formatTurnForSummary)
    .filter(Boolean)
    .join("\n\n");

  const messages = [
    {
      role: "system",
      content: `You summarize interactive fiction chapters for long-term story continuity.

Write thorough plain English prose (aim for 400–650 words; never under 300 unless the chapter was tiny).

Cover in flowing paragraphs (no bullet lists):
- Plot events in chronological order
- What the player (second-person "you") did and chose
- Character introductions, dialogue highlights, and relationship shifts
- Locations, objects, and facts that matter later
- Emotional beats and tone
- Countdowns, timers, or deadlines if present
- Unresolved hooks and open questions at chapter end

Be specific (names, places, consequences). Do not invent events absent from the transcript.`,
    },
    {
      role: "user",
      content: `Chapter title: ${chapterTitle}\n\nTranscript:\n${transcript.slice(0, 48000)}`,
    },
  ];

  return completeOpenRouter(settings, messages, {
    maxTokens: 2200,
    temperature: 0.35,
  });
}

/** @deprecated Use regenerateRollingSummary from rollingSummary.ts */
export async function summarizeRolling(
  settings: OpenRouterSettings,
  allTurns: ChatTurn[],
  _existingRolling?: string | null,
  opts?: { chapterTitle?: string | null; phaseHint?: string | null },
): Promise<string> {
  return regenerateRollingSummary(settings, allTurns, opts);
}
