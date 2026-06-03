import type { StoryContentLocale } from "@/lib/story/protagonist";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export type QuickReactionId = "laugh" | "cry" | "smile";

const REACTION_PROMPTS_EN: Record<QuickReactionId, string> = {
  laugh:
    "[Steering — not stored as a player message: The protagonist laughs in the current situation. Continue the scene naturally; brief reactions from others if fitting. Do not repeat prior text. End at a natural pause.]",
  cry:
    "[Steering — not stored as a player message: The protagonist is moved to tears (or fights them back) in the current situation. Continue the scene with emotional weight. Do not repeat prior text. End at a natural pause.]",
  smile:
    "[Steering — not stored as a player message: The protagonist smiles in the current situation. Continue the scene naturally. Do not repeat prior text. End at a natural pause.]",
};

const REACTION_PROMPTS_DE: Record<QuickReactionId, string> = {
  laugh:
    "[Steuerung — keine Spieler-Nachricht im Chat: Der Protagonist lacht in der aktuellen Situation. Szene natürlich fortsetzen; kurze Reaktionen anderer, wenn passend. Nichts wiederholen. Natürliche Pause am Ende.]",
  cry:
    "[Steuerung — keine Spieler-Nachricht im Chat: Der Protagonist ist bewegt bis zu Tränen (oder unterdrückt sie) in der aktuellen Situation. Szene mit emotionaler Tiefe fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]",
  smile:
    "[Steuerung — keine Spieler-Nachricht im Chat: Der Protagonist lächelt in der aktuellen Situation. Szene natürlich fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]",
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
    return `[Steuerung — keine Spieler-Nachricht im Chat: Der Protagonist sagt: „${trimmed}“. Szene mit dieser Zeile fortsetzen. Nichts wiederholen. Natürliche Pause am Ende.]`;
  }
  return `[Steering — not stored as a player message: The protagonist says: "${trimmed}". Continue the scene with this line spoken. Do not repeat prior text. End at a natural pause.]`;
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
