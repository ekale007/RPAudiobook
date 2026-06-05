import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import type { ChatTurn } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

const TAIL_MAX_CHARS = 480;

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

export function seamlessContinuationRule(
  storyLocale?: string | null,
): string {
  const de = normalizeStoryLocale(storyLocale) === "de";
  if (de) {
    return `**Nahtloser Anschluss (Pflicht):** Schreibe die **unmittelbare Fortsetzung** der laufenden Szene — keinen neuen Anfang, kein Reset. Wiederhole **nicht**, was der letzte Erzähler-Abschnitt schon etabliert hat (Position, Haltung, Aussehen, Wetter, „sie wartet“, „die Tür steht offen“, Atmosphäre-Floskeln). Starte mit der **nächsten** Bewegung, Handlung, Reaktion oder Konsequenz. Maximal **ein** kurzer Übergangssatz, wenn nötig — dann sofort weiter.`;
  }
  return `**Seamless continuation (required):** Write the **immediate next beat** — not a fresh opening or scene reset. Do **not** repeat what the last narrator block already established (positions, poses, appearance, weather, "she waits", "the door stands open", atmosphere filler). Start with the **next** motion, action, reaction, or consequence. At most **one** short bridge sentence if needed — then move on.`;
}

export function appendSeamlessContinuationHint(
  writerTask: string,
  turns: ChatTurn[],
  storyLocale?: string | null,
): string {
  const tail = getLastAssistantTail(turns);
  const rule = seamlessContinuationRule(storyLocale);
  const de = normalizeStoryLocale(storyLocale) === "de";
  const tailBlock = tail
    ? de
      ? `\n\nLetzter Erzähler-Abschnitt endete ungefähr so:\n«${tail}»\n\nSchließe **direkt** daran an.`
      : `\n\nThe last narrator block ended roughly:\n«${tail}»\n\nContinue **directly** from there.`
    : "";
  return `${writerTask.trim()}\n\n${rule}${tailBlock}`;
}
