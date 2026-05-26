import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { ChatTurn, OpenRouterSettings } from "@/lib/types";

export async function summarizeChapter(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  chapterTitle: string,
): Promise<string> {
  const transcript = turns
    .filter((t) => t.role !== "system")
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");

  const messages = [
    {
      role: "system",
      content:
        "You summarize interactive fiction chapters for continuity. Output plain English prose, 150-300 words. Include: key events, emotional beats, relationship changes, countdown/timer state if mentioned, and open hooks. No bullet lists.",
    },
    {
      role: "user",
      content: `Chapter title: ${chapterTitle}\n\nTranscript:\n${transcript.slice(0, 24000)}`,
    },
  ];

  return completeOpenRouter(settings, messages);
}

export async function summarizeRolling(
  settings: OpenRouterSettings,
  recentTurns: ChatTurn[],
  existingRolling?: string | null,
): Promise<string> {
  const transcript = recentTurns
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n\n");

  const messages = [
    {
      role: "system",
      content:
        "Update a short running summary (max 120 words) for an ongoing RPG chapter. Merge with prior summary if provided. Facts only.",
    },
    {
      role: "user",
      content: `Prior summary:\n${existingRolling ?? "(none)"}\n\nNew turns:\n${transcript}`,
    },
  ];

  return completeOpenRouter(settings, messages);
}
