import { buildChatMessages } from "@/lib/prompt/buildPrompt";
import type { PromptContext } from "@/lib/prompt/buildPrompt";
import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { OpenRouterSettings } from "@/lib/types";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";

export type StoryBeatOption = {
  id: string;
  title: string;
  /** Short player-facing teaser (2–3 sentences). */
  intro: string;
  /** Hidden writer instruction when this beat is chosen. */
  direction: string;
};

const BEATS_USER_PROMPT_EN = `You are a story beat advisor for an interactive RPG. Based on the conversation so far, propose exactly 3 meaningfully DIFFERENT directions the scene could go next (different focus, tone, or consequence).

Return ONLY valid JSON (no markdown, no commentary):
{"options":[{"id":"1","title":"Short headline (max 6 words)","intro":"2-3 sentences in second person as a teaser. Present tense. Do not resolve the scene or speak for the player.","direction":"One clear sentence telling the narrator what to write if the player picks this."},{"id":"2","title":"...","intro":"...","direction":"..."},{"id":"3","title":"...","intro":"...","direction":"..."}]}

Rules:
- Write title, intro, and direction in English.
- "intro" = teaser only (what the player reads before choosing)
- "direction" = writer brief only (not shown to the player)
- Stay in story tone; no deus ex machina unless earned
- Each option must feel like a real fork, not three versions of the same beat`;

const BEATS_USER_PROMPT_DE = `Du bist Story-Beat-Berater für ein interaktives RPG. Basierend auf dem bisherigen Gespräch schlage genau 3 DEUTLICH UNTERSCHIEDLICHE Richtungen vor, wohin die Szene als Nächstes gehen könnte (anderer Fokus, Ton oder Konsequenz).

Gib NUR gültiges JSON zurück (kein Markdown, kein Kommentar):
{"options":[{"id":"1","title":"Kurze Überschrift (max. 6 Wörter)","intro":"2–3 Sätze in der zweiten Person als Teaser. Präsens. Szene nicht auflösen, nicht für den Spieler sprechen.","direction":"Ein klarer Satz an den Erzähler, was er schreiben soll, wenn der Spieler diese Option wählt."},{"id":"2","title":"...","intro":"...","direction":"..."},{"id":"3","title":"...","intro":"...","direction":"..."}]}

Regeln:
- title, intro und direction auf Deutsch schreiben — auch wenn frühere Systemnachrichten Englisch waren.
- "intro" = nur Teaser (was der Spieler vor der Wahl liest)
- "direction" = nur Autoren-Briefing (wird dem Spieler nicht gezeigt)
- Im Story-Ton bleiben; kein Deus ex Machina ohne Setup
- Jede Option muss eine echte Gabelung sein, nicht drei Varianten desselben Beats`;

function beatsUserPrompt(locale: "de" | "en"): string {
  return locale === "de" ? BEATS_USER_PROMPT_DE : BEATS_USER_PROMPT_EN;
}

const DEFAULT_CONTINUE =
  "[Continue the story naturally from where the last beat left off. Keep momentum and tone; don't repeat what was just said. End at a natural pause for the player.]";

export function defaultContinuePrompt(): string {
  return DEFAULT_CONTINUE;
}

export function buildPlayBeatPrompt(beat: StoryBeatOption): string {
  return `[The player chose this story direction: "${beat.title}".
Narrator brief: ${beat.direction}
Write the full next story beat. Do not repeat prior text. End at a natural pause for the player.]`;
}

export function parseStoryBeatOptions(raw: string): StoryBeatOption[] {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;

  try {
    const parsed = JSON.parse(candidate) as {
      options?: Array<Partial<StoryBeatOption>>;
    };
    const list = parsed.options ?? [];
    return list
      .map((o, i) => normalizeOption(o, i))
      .filter((o): o is StoryBeatOption => o !== null);
  } catch {
    return [];
  }
}

function normalizeOption(
  o: Partial<StoryBeatOption>,
  index: number,
): StoryBeatOption | null {
  const title = o.title?.trim();
  const intro = o.intro?.trim();
  const direction = o.direction?.trim();
  if (!title || !intro || !direction) return null;
  return {
    id: String(o.id ?? index + 1),
    title,
    intro,
    direction,
  };
}

export type FetchBeatsParams = {
  settings: OpenRouterSettings;
  promptCtx: PromptContext;
  storyLocale?: string | null;
  signal?: AbortSignal;
};

export async function fetchStoryBeatSuggestions(
  params: FetchBeatsParams,
): Promise<StoryBeatOption[]> {
  const { messages } = buildChatMessages(params.promptCtx);
  const locale = normalizeStoryLocale(params.storyLocale);

  const withRequest = [
    ...messages,
    { role: "user" as const, content: beatsUserPrompt(locale) },
  ];

  const raw = await completeOpenRouter(params.settings, withRequest, {
    maxTokens: 900,
    temperature: 0.88,
    signal: params.signal,
  });

  const options = parseStoryBeatOptions(raw);
  if (options.length < 3) {
    throw new Error(
      "Konnte keine 3 Vorschläge lesen. Nochmal tippen oder „Einfach weiterspielen“.",
    );
  }
  return options.slice(0, 3);
}
