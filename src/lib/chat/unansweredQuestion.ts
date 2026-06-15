import {
  parseSpeakerBlocks,
  preprocessAssistantMarkup,
  stripSpeakerTags,
} from "@/lib/chat/parseSpeakerBlocks";
import { PROTAGONIST_SPEAKER_SLUG } from "@/lib/story/protagonist";
import type { ChatTurn } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

const PLAYER_PROMPT_PATTERNS = [
  /\bwas tust du\b/i,
  /\bwhat do you do\b/i,
  /\bwas sagst du\b/i,
  /\bwhat do you say\b/i,
  /\bwas machst du\b/i,
  /\bwhat will you do\b/i,
  /\bhow do you respond\b/i,
  /\bwie antwortest du\b/i,
];

function tailText(text: string, max = 420): string {
  const plain = stripSpeakerTags(text).replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return plain.slice(-max);
}

function blockEndsWithQuestion(blockContent: string): boolean {
  const t = stripSpeakerTags(blockContent).trim();
  if (!t.includes("?")) return false;
  const lastLine = t.split("\n").pop()?.trim() ?? t;
  return /\?[\s"”'»]*$/.test(lastLine) || lastLine.includes("?");
}

function addressesPlayer(text: string, locale: "de" | "en"): boolean {
  if (locale === "de") {
    return /\b(du|dich|dir|dein|deine|deinem|ihr|euch)\b/i.test(text);
  }
  return /\b(you|your|you're|you'll)\b/i.test(text);
}

/** True when the last assistant beat ends on a question the player was expected to answer. */
export function lastAssistantTurnAwaitingPlayer(
  turns: ChatTurn[],
  storyLocale?: string | null,
): boolean {
  const last = turns[turns.length - 1];
  if (last?.role !== "assistant") return false;

  const locale = normalizeStoryLocale(storyLocale);
  const tail = tailText(last.content);
  if (PLAYER_PROMPT_PATTERNS.some((re) => re.test(tail))) return true;

  const blocks = parseSpeakerBlocks(preprocessAssistantMarkup(last.content));
  const lastBlock = blocks[blocks.length - 1];
  if (!lastBlock) {
    return /\?[\s"”'»]*$/.test(tail);
  }

  if (lastBlock.speakerSlug === PROTAGONIST_SPEAKER_SLUG) {
    return false;
  }

  const blockText = stripSpeakerTags(lastBlock.content).trim();
  if (!blockText.includes("?")) return false;

  if (lastBlock.speakerSlug === "narrator") {
    return (
      blockEndsWithQuestion(blockText) ||
      addressesPlayer(blockText, locale) ||
      PLAYER_PROMPT_PATTERNS.some((re) => re.test(blockText))
    );
  }

  // Cast / guest dialogue with a question — player is usually expected to answer.
  return blockEndsWithQuestion(blockText) || blockText.includes("?");
}

const INTERVENTION_DE =
  "[Der Spieler hat nicht reagiert (keine Steuerung). Der Erzähler greift ein: Schreibe keine lange Stille, kein wiederholtes „Stille“/„Schweigen“/„silence“. Stattdessen (a) der Protagonist antwortet mit vorsichtiger, charaktertreuer Eigeninitiative, (b) ein NPC reagiert auf das Ausbleiben einer Antwort und treibt die Szene voran, oder (c) der Erzähler setzt mit einer konkreten Entwicklung fort. Offene Fragen an den Spieler durch Handlung beantworten — nicht durch Leerstellen. Fließend vom letzten Beat; nichts wiederholen. Natürliche Pause am Ende.]";

const INTERVENTION_EN =
  "[The player did not steer (no input). The narrator intervenes: Do not write long silence or repeated “silence”/“quiet”/“stillness”. Instead (a) the protagonist answers with cautious, in-character initiative, (b) an NPC reacts to the missing reply and moves the scene forward, or (c) the narrator advances with a concrete development. Answer open questions to the player through action — not empty beats. Flow from the last beat; don't repeat prior text. End at a natural pause.]";

const AUTO_PACING_DE =
  " Gleichmäßiges Tempo; keine Zeitsprünge, außer der Spieler hat die Zeit bereits vorgezogen.";

const AUTO_PACING_EN =
  " Keep pacing steady; no time skips unless the player already moved time forward.";

export function buildNarratorInterventionPrompt(
  storyLocale?: string | null,
  opts?: { autoPacing?: boolean },
): string {
  const locale = normalizeStoryLocale(storyLocale);
  let base = locale === "de" ? INTERVENTION_DE : INTERVENTION_EN;
  if (opts?.autoPacing) {
    base += locale === "de" ? AUTO_PACING_DE : AUTO_PACING_EN;
  }
  return base;
}

export function isExplicitBeatContinuationPrompt(prompt: string): boolean {
  return /player chose this story direction|spieler wählte diese richtung/i.test(
    prompt,
  );
}

/** Pick continuation writer task when the player did not steer after a question. */
export function resolveContinuationWriterTask(
  turns: ChatTurn[],
  basePrompt: string,
  storyLocale?: string | null,
): string {
  if (isExplicitBeatContinuationPrompt(basePrompt)) return basePrompt;
  if (!lastAssistantTurnAwaitingPlayer(turns, storyLocale)) return basePrompt;

  const autoPacing = /keep pacing steady|gleichmäßiges tempo/i.test(
    basePrompt,
  );
  return buildNarratorInterventionPrompt(storyLocale, { autoPacing });
}
