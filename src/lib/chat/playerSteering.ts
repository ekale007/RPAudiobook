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

/**
 * Single user message for the LLM when the last stored turn is a steering bubble.
 * Merges player intent into one mandatory writer task (DB still keeps the steering turn for UI).
 */
export function buildSteeringWriterTaskMessage(
  display: string,
  storyLocale?: string | null,
  protagonistName?: string | null,
): string {
  const locale = normalizeStoryLocale(storyLocale);
  const de = locale === "de";
  const player =
    protagonistName?.trim() || (de ? "der Protagonist (du)" : "the protagonist (you)");
  const kind = classifySteeringDisplay(display);

  if (kind === "reaction") {
    const beat = display.trim();
    if (de) {
      return `## Aufgabe: Nächster Erzähler-Abschnitt (Pflicht)

Der Spieler hat soeben gesteuert: **${beat}**

Das MUSS in deiner Antwort sichtbar werden — nicht nur andeuten:
1. \`<<speaker:narrator>>\` — kurze Brücke; zeige die Reaktion von ${player} klar in der Szene.
2. Optional andere Sprecher / weiterer \`<<speaker:narrator>>\` bis zur natürlichen Pause.

Pflicht-Stil: Dialog-Skript mit \`<<speaker:…>>\`-Tags. Keine wörtliche Wiederholung früherer Absätze.`;
    }
    return `## Task: Next narrator segment (required)

The player just steered: **${beat}**

You MUST show this in your reply — do not only hint at it:
1. \`<<speaker:narrator>>\` — brief bridge; make ${player}'s reaction clear in the scene.
2. Optional other speakers / more \`<<speaker:narrator>>\` until a natural pause.

Required: dialogue script with \`<<speaker:…>>\` tags. Do not repeat earlier paragraphs verbatim.`;
  }

  if (kind === "dialogue") {
    const line = normalizeSteeringDialogueInput(display);
    const quoted = de ? `„${line}"` : `"${line}"`;
    if (de) {
      return `## Aufgabe: Nächster Erzähler-Abschnitt (Pflicht)

Der Spieler hat eine **Dialogzeile** vorgegeben. Sie MUSS in deiner Antwort vorkommen.

**Pflicht-Satz des Protagonisten** (wörtlich oder leicht stilistisch geglättet — gleiche Bedeutung, keine andere Aussage):
${quoted}

**Reihenfolge (strikt — Abweichung = Fehler):**
1. \`<<speaker:narrator>>\` — **maximal 2 kurze Sätze** Brücke. Kein NPC spricht vor Schritt 2.
2. \`<<speaker:protagonist>>\` — **sofort danach** spricht ${player} den Pflicht-Satz: ${quoted}
   (nur dieser Satz als Zitat; optional ein Halbsatz davor wie „du fragst“.)
3. **Erst danach** dürfen NPCs antworten (z.\u202fB. mit Cast-Slug) — ihre Antwort bezieht sich auf die Frage/Aussage.

Erlaubt: leichte grammatische Glättung, wenn die Spielerzeile rau klingt.
**Verboten:** NPC beantwortet die Frage, bevor der Protagonist sie gestellt hat. Die Pflicht-Zeile nur im Erzähler-Fließtext ohne \`<<speaker:protagonist>>\`. Die Zeile später noch einmal unmarkiert wiederholen.
**Verboten:** Quest-UI, \`[QUEST-OPTION]\`, Interface, „Was tust du?“ — nur lebendige Prosa und Dialog-Skript.

Pflicht-Stil: Dialog-Skript mit \`<<speaker:…>>\`-Tags. Keine wörtliche Wiederholung früherer Absätze.`;
    }
    return `## Task: Next narrator segment (required)

The player supplied a **dialogue line**. It MUST appear in your reply.

**Mandatory protagonist line** (verbatim or lightly polished — same meaning, not a different statement):
${quoted}

**Order (strict — deviation is wrong):**
1. \`<<speaker:narrator>>\` — **at most 2 short sentences** of bridge. No NPC speaks before step 2.
2. \`<<speaker:protagonist>>\` — **immediately after**, ${player} speaks the mandatory line: ${quoted}
3. **Only then** may NPCs reply (with cast slugs) — their answer responds to what ${player} said.

Allowed: light grammatical polish if the player's line is rough.
**Forbidden:** an NPC answers before the protagonist asks/says it. The mandatory line only in narrator prose without \`<<speaker:protagonist>>\`. Repeating the line later without the protagonist tag.
**Forbidden:** quest UI, \`[QUEST-OPTION]\`, interfaces, "What do you do?" — only living prose and dialogue script.

Required: dialogue script with \`<<speaker:…>>\` tags. Do not repeat earlier paragraphs verbatim.`;
  }

  const action = display.trim().replace(/^⚡\s*/, "");
  if (de) {
    return `## Aufgabe: Nächster Erzähler-Abschnitt (Pflicht)

Der Spieler steuert eine **Handlung**: **${action}**

Das MUSS in deiner Antwort **sichtbar** passieren — nicht nur erwähnt:
1. \`<<speaker:narrator>>\` — zeige die Aktion des Protagonisten in der Szene (Bewegung, Sinne, Konsequenz in 2–5 Sätzen). Stilistisch glätten erlaubt, Absicht **nicht** ändern.
2. Optional \`<<speaker:protagonist>>\` / Cast-Dialog und weiterer \`<<speaker:narrator>>\` bis zur Pause.

**Verboten:** Die Aktion weglassen oder nur von anderen kommentieren lassen, ohne dass ${player} sie tut. Quest-UI, „Was tust du?“.

Pflicht-Stil: Dialog-Skript mit \`<<speaker:…>>\`-Tags. Keine wörtliche Wiederholung früherer Absätze.`;
  }
  return `## Task: Next narrator segment (required)

The player steers the action: **${action}**

You MUST realize this in your reply (prose and dialogue as needed):
1. \`<<speaker:narrator>>\` — show ${player} doing or starting this; you may polish wording, **not** change intent.
2. Optional dialogue with \`<<speaker:protagonist>>\` / cast and more narrator prose.

Required: dialogue script with \`<<speaker:…>>\` tags. Do not repeat earlier paragraphs verbatim.`;
}

/** @deprecated Merged into buildSteeringWriterTaskMessage via buildContinuationTurns */
export function buildDialogueSteeringPrompt(
  line: string,
  storyLocale?: string | null,
): string {
  return buildSteeringWriterTaskMessage(
    formatSteeringDialogueUserTurn(line, storyLocale).replace(
      STEERING_TURN_PREFIX,
      "",
    ),
    storyLocale,
  );
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

/** Build turn list for a continuation request (steering → one strong writer user message). */
export function buildContinuationTurns(
  turns: ChatTurn[],
  continuationPrompt?: string,
  storyLocale?: string | null,
  protagonistName?: string | null,
  writerTaskOverride?: string | null,
): ChatTurn[] {
  const fallback = continuationPrompt ?? defaultContinuePrompt();
  const last = turns[turns.length - 1];
  if (last?.role === "user" && isSteeringUserTurn(last.content)) {
    const display = stripSteeringTurnPrefix(last.content).trim();
    const merged =
      writerTaskOverride?.trim() ||
      buildSteeringWriterTaskMessage(
        display,
        storyLocale,
        protagonistName,
      );
    return [...turns.slice(0, -1), { role: "user", content: merged }];
  }
  return [...turns, { role: "user", content: fallback }];
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
      ? `<<speaker:narrator>>\nDu fässt die Situation einen Moment lang.\n\n<<speaker:protagonist>>\n${quoted}\n\n`
      : `<<speaker:narrator>>\nYou take in the scene for a moment.\n\n<<speaker:protagonist>>\n${quoted}\n\n`;

  return removeOrphanDuplicateQuoteLines(
    injection + text,
    line,
    storyLocale,
  );
}
