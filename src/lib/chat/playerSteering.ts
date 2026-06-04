import { defaultContinuePrompt } from "@/lib/chat/storyBeatSuggestions";
import type { StoryContentLocale } from "@/lib/story/protagonist";
import type { ChatTurn } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export type QuickReactionId = "laugh" | "cry" | "smile";

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

**Struktur (Pflicht):**
1. \`<<speaker:narrator>>\` — 1–3 Sätze Brücke zur laufenden Szene.
2. \`<<speaker:protagonist>>\` — Absatz, in dem ${player} **diesen Pflicht-Satz spricht** (deutsche Anführungszeichen „…").
3. Optional weitere Sprecher und \`<<speaker:narrator>>\` bis zur natürlichen Pause.

Erlaubt: leichte grammatische Glättung, wenn die Spielerzeile rau klingt.
**Verboten:** die Zeile weglassen, nur paraphrasieren ohne Zitat, oder eine andere Aussage erfinden.

Pflicht-Stil: Dialog-Skript mit \`<<speaker:…>>\`-Tags. Keine wörtliche Wiederholung früherer Absätze.`;
    }
    return `## Task: Next narrator segment (required)

The player supplied a **dialogue line**. It MUST appear in your reply.

**Mandatory protagonist line** (verbatim or lightly polished — same meaning, not a different statement):
${quoted}

**Required structure:**
1. \`<<speaker:narrator>>\` — 1–3 sentences bridging the current scene.
2. \`<<speaker:protagonist>>\` — paragraph where ${player} **speaks that mandatory line** in quotes.
3. Optional other speakers and \`<<speaker:narrator>>\` until a natural pause.

Allowed: light grammatical polish if the player's line is rough.
**Forbidden:** omitting the line, summarizing without quoted speech, or inventing different dialogue.

Required: dialogue script with \`<<speaker:…>>\` tags. Do not repeat earlier paragraphs verbatim.`;
  }

  const action = display.trim();
  if (de) {
    return `## Aufgabe: Nächster Erzähler-Abschnitt (Pflicht)

Der Spieler steuert die Handlung: **${action}**

Das MUSS in deiner Antwort umgesetzt werden (Prosa + ggf. Dialog):
1. \`<<speaker:narrator>>\` — zeige, wie ${player} das tut oder beginnt; du darfst die Formulierung stilistisch geglätten, **nicht** die Absicht ändern.
2. Optional Dialog mit \`<<speaker:protagonist>>\` / Cast und weiterer Erzähler-Prosa.

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

export function steeringInputPlaceholder(
  audiobookMode: boolean,
  locale: StoryContentLocale,
): string {
  if (audiobookMode) {
    return locale === "de"
      ? "Kurze Richtung oder Dialog …"
      : "Short steer or dialogue …";
  }
  return locale === "de" ? "Was tust du?" : "What do you do?";
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
): ChatTurn[] {
  const fallback = continuationPrompt ?? defaultContinuePrompt();
  const last = turns[turns.length - 1];
  if (last?.role === "user" && isSteeringUserTurn(last.content)) {
    const display = stripSteeringTurnPrefix(last.content).trim();
    const merged = buildSteeringWriterTaskMessage(
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
