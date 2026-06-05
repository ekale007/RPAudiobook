import { appendLightContinuationHint } from "@/lib/chat/continuationSeam";
import { defaultContinuePrompt } from "@/lib/chat/storyBeatSuggestions";
import {
  parseSpeakerBlocks,
  preprocessAssistantMarkup,
  stripSpeakerTags,
} from "@/lib/chat/parseSpeakerBlocks";
import { stripGameMetaLeaks } from "@/lib/chat/sanitizeAssistantOutput";
import {
  PROTAGONIST_SPEAKER_SLUG,
  type StoryContentLocale,
} from "@/lib/story/protagonist";
import type { ChatTurn } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export type QuickReactionId = "laugh" | "cry" | "smile";

export type SteeringInputMode = "auto" | "say" | "act";

/** Prefix on persisted user turns created from steering (stripped in UI). */
export const STEERING_TURN_PREFIX = "↪ ";

const REACTION_LABELS_DE: Record<QuickReactionId, string> = {
  laugh: "😂 Lachen",
  cry: "😢 Weinen",
  smile: "😊 Lächeln",
};

const REACTION_LABELS_EN: Record<QuickReactionId, string> = {
  laugh: "😂 Laugh",
  cry: "😢 Cry",
  smile: "😊 Smile",
};

const REACTION_PROMPTS_EN: Record<QuickReactionId, string> = {
  laugh:
    "[Steering: The player message above is the intended beat. The protagonist laughs in the current situation. Continue the scene naturally; brief reactions from others if fitting. Do not repeat prior text. End at a natural pause.]",
  cry:
    "[Steering: The player message above is the intended beat. The protagonist is moved to tears (or fights them back) in the current situation. Continue the scene with emotional weight. Do not repeat prior text. End at a natural pause.]",
  smile:
    "[Steering: The player message above is the intended beat. The protagonist smiles in the current situation. Continue the scene naturally. Do not repeat prior text. End at a natural pause.]",
};

const REACTION_PROMPTS_DE: Record<QuickReactionId, string> = {
  laugh:
    "[Steuerung: Die Spieler-Nachricht oben ist die gewünschte Richtung. Der Protagonist lacht in der aktuellen Situation. Szene natürlich fortsetzen; kurze Reaktionen anderer, wenn passend. Nichts wiederholen. Natürliche Pause am Ende.]",
  cry:
    "[Steuerung: Die Spieler-Nachricht oben ist die gewünschte Richtung. Der Protagonist ist bewegt bis zu Tränen (oder unterdrückt sie) in der aktuellen Situation. Szene mit emotionaler Tiefe fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]",
  smile:
    "[Steuerung: Die Spieler-Nachricht oben ist die gewünschte Richtung. Der Protagonist lächelt in der aktuellen Situation. Szene natürlich fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]",
};

export function buildReactionSteeringPrompt(
  reaction: QuickReactionId,
  storyLocale?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  return locale === "de"
    ? REACTION_PROMPTS_DE[reaction]
    : REACTION_PROMPTS_EN[reaction];
}

export type SteeringDisplayKind = "dialogue" | "reaction" | "direction";

const ALL_REACTION_LABELS = [
  ...Object.values(REACTION_LABELS_DE),
  ...Object.values(REACTION_LABELS_EN),
];

export function classifySteeringDisplay(display: string): SteeringDisplayKind {
  const t = display.trim();
  if (t.startsWith("⚡")) return "direction";
  if (ALL_REACTION_LABELS.includes(t)) return "reaction";
  if (
    /^[\u201e\u201c"]/.test(t) ||
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("„") && /[\u201c\u201d"]$/.test(t))
  ) {
    return "dialogue";
  }
  return "direction";
}

const REACTION_IDS: QuickReactionId[] = ["laugh", "cry", "smile"];

function reactionIdFromDisplay(display: string): QuickReactionId | null {
  const t = display.trim();
  for (const id of REACTION_IDS) {
    if (t === REACTION_LABELS_DE[id] || t === REACTION_LABELS_EN[id]) return id;
  }
  return null;
}

export function buildDialogueSteeringPrompt(
  line: string,
  storyLocale?: string | null,
): string {
  const trimmed = line.trim();
  const locale = normalizeStoryLocale(storyLocale);
  if (locale === "de") {
    return `[Steuerung: Die Spieler-Nachricht direkt darüber ist die Dialogzeile. Der Protagonist sagt: „${trimmed}". Szene fließend fortsetzen — dieselbe Zeile unter <<speaker:protagonist>>; kein Szene-Reset. Natürliche Pause am Ende.]`;
  }
  return `[Steering: The player message directly above is the dialogue line. The protagonist says: "${trimmed}". Continue seamlessly — same line under <<speaker:protagonist>>; no scene reset. End at a natural pause.]`;
}

export function buildActionSteeringPrompt(
  action: string,
  storyLocale?: string | null,
): string {
  const trimmed = action.trim().replace(/^⚡\s*/, "");
  const locale = normalizeStoryLocale(storyLocale);
  if (locale === "de") {
    return `[Steuerung: Die Spieler-Nachricht direkt darüber ist die Handlung — ${trimmed}. In die laufende Szene einweben und geschehen lassen; fließend vom letzten Beat, nichts wiederholen. Natürliche Pause am Ende.]`;
  }
  return `[Steering: The player message directly above is the action — ${trimmed}. Weave it into the live scene; flow from the last beat, don't repeat prior text. End at a natural pause.]`;
}

/** Light continuation hint appended after the steering bubble (keeps flow; bubble stays in history). */
export function buildSteeringContinuationPrompt(
  display: string,
  storyLocale?: string | null,
): string {
  const kind = classifySteeringDisplay(display);
  if (kind === "reaction") {
    const id = reactionIdFromDisplay(display);
    if (id) return buildReactionSteeringPrompt(id, storyLocale);
  }
  if (kind === "dialogue") {
    return buildDialogueSteeringPrompt(
      normalizeSteeringDialogueInput(display),
      storyLocale,
    );
  }
  return buildActionSteeringPrompt(display, storyLocale);
}

export function isSteeringUserTurn(content: string): boolean {
  return content.startsWith(STEERING_TURN_PREFIX);
}

export function stripSteeringTurnPrefix(content: string): string {
  return isSteeringUserTurn(content)
    ? content.slice(STEERING_TURN_PREFIX.length)
    : content;
}

export function formatSteeringUserTurnContent(
  display: string,
): string {
  return `${STEERING_TURN_PREFIX}${display.trim()}`;
}

export function formatSteeringReactionUserTurn(
  reaction: QuickReactionId,
  storyLocale?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  const label =
    locale === "de"
      ? REACTION_LABELS_DE[reaction]
      : REACTION_LABELS_EN[reaction];
  return formatSteeringUserTurnContent(label);
}

export function formatSteeringDialogueUserTurn(
  line: string,
  storyLocale?: string | null,
): string {
  const trimmed = line.trim();
  const locale = normalizeStoryLocale(storyLocale);
  const quoted =
    locale === "de" ? `„${trimmed}"` : `"${trimmed}"`;
  return formatSteeringUserTurnContent(quoted);
}

export function formatSteeringActionUserTurn(
  action: string,
  storyLocale?: string | null,
): string {
  void storyLocale;
  const t = action.trim().replace(/^⚡\s*/, "");
  const label = t.startsWith("⚡") ? t : `⚡ ${t}`;
  return formatSteeringUserTurnContent(label);
}

export function steeringInputPlaceholder(
  audiobookMode: boolean,
  locale: StoryContentLocale,
  inputMode: SteeringInputMode = "auto",
): string {
  if (!audiobookMode) {
    return locale === "de" ? "Was tust du?" : "What do you do?";
  }
  if (inputMode === "say") {
    return locale === "de" ? "Was sagst du? …" : "What do you say? …";
  }
  if (inputMode === "act") {
    return locale === "de"
      ? "Was tust du? z. B. zur Tür gehen …"
      : "What do you do? e.g. walk to the door …";
  }
  return locale === "de"
    ? 'Sagen (mit „…") oder Handlung …'
    : "Say (in quotes) or describe an action …";
}


/** Empty dialogue field with cursor between opening and closing quote. */
export function emptyDialogueInput(locale: StoryContentLocale): {
  text: string;
  cursor: number;
} {
  if (locale === "de") {
    return { text: "„\"", cursor: 1 };
  }
  return { text: '""', cursor: 1 };
}

/** Build turn list for a continuation request (steering bubble stays; light hint appended). */
export function buildContinuationTurns(
  turns: ChatTurn[],
  continuationPrompt?: string,
  storyLocale?: string | null,
): ChatTurn[] {
  const fallback = continuationPrompt ?? defaultContinuePrompt();
  const last = turns[turns.length - 1];
  if (last?.role === "user" && isSteeringUserTurn(last.content)) {
    const display = stripSteeringTurnPrefix(last.content).trim();
    const prompt =
      continuationPrompt?.trim() ||
      buildSteeringContinuationPrompt(display, storyLocale);
    return [...turns, { role: "user", content: prompt }];
  }
  return [
    ...turns,
    {
      role: "user",
      content: appendLightContinuationHint(fallback, turns, storyLocale),
    },
  ];
}

export function normalizeSteeringDialogueInput(raw: string): string {
  let t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("„") && t.endsWith("\"")) ||
    (t.startsWith("„") && t.endsWith("“")) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protagonistBlockContainsLine(text: string, line: string): boolean {
  const needle = line.trim().toLowerCase();
  if (!needle) return false;
  for (const block of parseSpeakerBlocks(text)) {
    if (block.speakerSlug !== PROTAGONIST_SPEAKER_SLUG) continue;
    const body = stripSpeakerTags(block.content).toLowerCase();
    if (body.includes(needle)) return true;
  }
  return false;
}

/** Drop orphan quote-only lines the model pasted outside speaker tags. */
function removeOrphanDuplicateQuoteLines(
  text: string,
  line: string,
  storyLocale?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  const core = line.trim();
  if (!core) return text;
  const patterns = [
    new RegExp(`^„\\s*${escapeRegex(core)}\\s*["”]?$`, "i"),
    new RegExp(`^"\\s*${escapeRegex(core)}\\s*"$`, "i"),
    new RegExp(`^'\\s*${escapeRegex(core)}\\s*'$`, "i"),
  ];
  if (locale === "de") {
    patterns.push(
      new RegExp(`^${escapeRegex(core)}\\s*\\??$`, "i"),
    );
  }
  return text
    .split("\n")
    .filter((row) => {
      const t = row.trim();
      if (!t) return true;
      return !patterns.some((re) => re.test(t));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Sanitize model output and ensure steering dialogue appears under <<speaker:protagonist>>.
 */
export function repairAssistantReplyForSteering(
  raw: string,
  steeringDisplay: string,
  storyLocale?: string | null,
): string {
  let text = stripGameMetaLeaks(preprocessAssistantMarkup(raw));
  if (classifySteeringDisplay(steeringDisplay) !== "dialogue") {
    return text;
  }

  const line = normalizeSteeringDialogueInput(steeringDisplay);
  if (!line) return text;

  if (protagonistBlockContainsLine(text, line)) {
    return removeOrphanDuplicateQuoteLines(text, line, storyLocale);
  }

  const locale = normalizeStoryLocale(storyLocale);
  const quoted = locale === "de" ? `„${line}"` : `"${line}"`;
  const injection =
    locale === "de"
      ? `<<speaker:protagonist>>\n${quoted}\n\n`
      : `<<speaker:protagonist>>\n${quoted}\n\n`;

  return removeOrphanDuplicateQuoteLines(
    injection + text,
    line,
    storyLocale,
  );
}
