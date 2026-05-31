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

function buildTranscript(turns: ChatTurn[], maxChars = 40000): string {
  const lines = turns
    .filter((t) => t.role !== "system")
    .map(formatTurnForSummary)
    .filter(Boolean);
  const full = lines.join("\n\n");
  if (full.length <= maxChars) return full;
  return `[Earlier lines omitted — ${lines.length} turns total. Summary must match the END of the transcript.]\n\n${full.slice(-maxChars)}`;
}

/**
 * Rebuild chapter rolling memory from the full transcript (not incremental merge).
 * Reduces "jumping back" after rewind/reroll or drift from partial updates.
 */
export async function regenerateRollingSummary(
  settings: OpenRouterSettings,
  turns: ChatTurn[],
  opts?: {
    chapterTitle?: string | null;
    phaseHint?: string | null;
  },
): Promise<string> {
  if (!turns.some((t) => t.role !== "system")) {
    return "";
  }

  const transcript = buildTranscript(turns);
  const header = [
    opts?.chapterTitle ? `Chapter: ${opts.chapterTitle}` : null,
    opts?.phaseHint ? `Author timeline hint: ${opts.phaseHint}` : null,
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
