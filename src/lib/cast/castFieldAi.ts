/**
 * Per-field AI suggestion for an existing cast character.
 *
 * Unlike randomizeStoryField (which drives the story-draft editor with a
 * full StoryDraft), this works directly on a DB CharacterRow: one field at
 * a time, grounded in the story concept + current card state.
 */
import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { OpenRouterSettings } from "@/lib/types";

export type CastField = "description" | "personality" | "memory";

const FIELD_INSTRUCTIONS: Record<CastField, string> = {
  description:
    "Physical traits, role and backstory in 2-4 sentences of worldbuilding-style prose.",
  personality: "Personality traits and speech style — how this character talks, feels, reacts.",
  memory:
    "2-4 sentences of story-specific memory: what has happened to this character in this story so far. Ground it in the provided concept. If the concept gives nothing concrete, describe their starting situation.",
};

export async function suggestCastField(
  settings: OpenRouterSettings,
  opts: {
    field: CastField;
    characterName: string;
    characterRole: string;
    currentValue: string;
    storyTitle?: string;
    storyConcept?: string | null;
    locale: "de" | "en";
  },
): Promise<string> {
  const lang =
    opts.locale === "en"
      ? "Write in English."
      : "Schreibe auf Deutsch.";

  const raw = await completeOpenRouter(
    settings,
    [
      {
        role: "system",
        content: `You help author interactive audiobook characters (StoryTeller format).

Improve or generate the "${opts.field}" field of a character card.

Instructions for this field: ${FIELD_INSTRUCTIONS[opts.field]}

Return ONLY valid JSON: {"value":"..."} with the new field text in "value".
${lang}`,
      },
      {
        role: "user",
        content: [
          opts.storyTitle ? `Story: ${opts.storyTitle}` : null,
          opts.storyConcept?.trim()
            ? `Concept:\n${opts.storyConcept.trim()}`
            : null,
          `Character: ${opts.characterName} (${opts.characterRole})`,
          opts.currentValue.trim()
            ? `Current value:\n${opts.currentValue}`
            : "Current value: (empty)",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    {
      maxTokens: opts.field === "description" ? 700 : 900,
      temperature: 0.8,
      responseFormat: { type: "json_object" },
    },
  );

  try {
    const parsed = JSON.parse(raw) as { value?: string };
    if (typeof parsed.value === "string" && parsed.value.trim()) {
      return parsed.value.trim();
    }
  } catch {
    /* fallthrough */
  }
  // Forgiving: strip surrounding quotes if model returned plain text.
  return raw.replace(/^["']|["']$/g, "").trim();
}