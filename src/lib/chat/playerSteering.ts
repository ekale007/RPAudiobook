import type { StoryContentLocale } from "@/lib/story/protagonist";
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

export function buildDialogueSteeringPrompt(
  line: string,
  storyLocale?: string | null,
): string {
  const trimmed = line.trim();
  const locale = normalizeStoryLocale(storyLocale);
  if (locale === "de") {
    return `[Steuerung: Die Spieler-Nachricht oben ist die Dialogzeile. Der Protagonist sagt: „${trimmed}“. Szene mit dieser Zeile fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]`;
  }
  return `[Steering: The player message above is the dialogue line. The protagonist says: "${trimmed}". Continue the scene with this line spoken. Do not repeat prior text. End at a natural pause.]`;
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

/** Strip wrapping quotes the player may have typed for dialogue. */
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
