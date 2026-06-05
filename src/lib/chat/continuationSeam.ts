import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import type { ChatTurn } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

const TAIL_MAX_CHARS = 220;

/** Last lines of the most recent assistant turn — anchor for seamless continuation. */
export function getLastAssistantTail(
  turns: ChatTurn[],
  maxChars = TAIL_MAX_CHARS,
): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role !== "assistant") continue;
    const plain = stripSpeakerTags(t.content).replace(/\s+/g, " ").trim();
    if (!plain) continue;
    if (plain.length <= maxChars) return plain;
    const slice = plain.slice(-maxChars);
    const cut = slice.indexOf(" ");
    return (cut > 40 ? slice.slice(cut + 1) : slice).trim();
  }
  return "";
}

/** Subtle tail hint for autoplay / plain continue — not used on steering (bubble + light prompt). */
export function appendLightContinuationHint(
  writerTask: string,
  turns: ChatTurn[],
  storyLocale?: string | null,
): string {
  const tail = getLastAssistantTail(turns);
  if (!tail) return writerTask.trim();
  const de = normalizeStoryLocale(storyLocale) === "de";
  const hint = de
    ? ` Pick up mid-scene after: «${tail}»`
    : ` Pick up mid-scene after: «${tail}»`;
  return `${writerTask.trim()}${hint}`;
}
