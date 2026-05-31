import { completeOpenRouter } from "@/lib/llm/openrouter";
import { slugifyCharacterName } from "@/lib/memory/characterMemory";
import type { WryTourSeedPack } from "@/lib/import/wrytour";
import type {
  OpenRouterSettings,
  WryTourCharacter,
  WryTourLorebook,
} from "@/lib/types";

export interface StoryDraftInput {
  concept: string;
  locale: "de" | "en";
  genre?: string;
  tone?: string;
}

export interface StoryDraft {
  storyTitle: string;
  locale: string;
  bandTitle: string;
  chapterTitle: string;
  phaseHint?: string;
  worldLorebook: WryTourLorebook;
  characters: Array<{
    slug: string;
    role: "narrator" | "cast";
    card: WryTourCharacter;
  }>;
}

const STORY_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "storyTitle",
    "bandTitle",
    "chapterTitle",
    "worldLorebook",
    "characters",
  ],
  properties: {
    storyTitle: { type: "string" },
    bandTitle: { type: "string" },
    chapterTitle: { type: "string" },
    phaseHint: { type: "string" },
    worldLorebook: {
      type: "object",
      additionalProperties: false,
      required: ["name", "entries"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        entries: {
          type: "array",
          minItems: 4,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["keys", "content"],
            properties: {
              keys: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 6,
              },
              content: { type: "string" },
              comment: { type: "string" },
            },
          },
        },
      },
    },
    characters: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "role", "card"],
        properties: {
          slug: { type: "string" },
          role: { type: "string", enum: ["narrator", "cast"] },
          card: {
            type: "object",
            additionalProperties: false,
            required: ["name", "description", "personality", "system_prompt"],
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              personality: { type: "string" },
              scenario: { type: "string" },
              first_mes: { type: "string" },
              mes_example: { type: "string" },
              creator_notes: { type: "string" },
              system_prompt: { type: "string" },
              post_history_instructions: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;

function normalizeSlug(raw: string, fallback: string): string {
  const s = slugifyCharacterName(raw || fallback);
  return s || fallback;
}

export function parseStoryDraftJson(raw: string, locale: string): StoryDraft {
  const parsed = JSON.parse(raw) as StoryDraft;
  if (!parsed.storyTitle?.trim()) throw new Error("Missing story title");
  if (!parsed.worldLorebook?.entries?.length) {
    throw new Error("Missing lorebook entries");
  }
  if (!parsed.characters?.length) throw new Error("Missing characters");
  const narrators = parsed.characters.filter((c) => c.role === "narrator");
  if (narrators.length !== 1) {
    throw new Error("Exactly one narrator character is required");
  }

  const slugs = new Set<string>();
  const characters = parsed.characters.map((c, i) => {
    const slug = normalizeSlug(
      c.slug,
      c.role === "narrator" ? "narrator" : `cast-${i}`,
    );
    if (slugs.has(slug)) throw new Error(`Duplicate character slug: ${slug}`);
    slugs.add(slug);
    return {
      slug,
      role: c.role,
      card: {
        ...c.card,
        name: c.card.name?.trim() || slug,
        creator: c.card.creator ?? "HörbuchKI Story Editor",
        character_version: "v1-editor",
      },
    };
  });

  return {
    storyTitle: parsed.storyTitle.trim(),
    locale,
    bandTitle: parsed.bandTitle?.trim() || "Band I",
    chapterTitle: parsed.chapterTitle?.trim() || "Kapitel 1",
    phaseHint: parsed.phaseHint?.trim() || undefined,
    worldLorebook: {
      name: parsed.worldLorebook.name?.trim() || "World Bible",
      description: parsed.worldLorebook.description,
      entries: parsed.worldLorebook.entries.map((e, idx) => ({
        keys: e.keys.map((k) => k.trim()).filter(Boolean),
        content: e.content.trim(),
        comment: e.comment,
        order: (idx + 1) * 10,
        position: 0,
        enabled: true,
      })),
    },
    characters,
  };
}

export function draftToSeedPack(draft: StoryDraft): WryTourSeedPack {
  return {
    characters: draft.characters,
    lorebooks: [{ slug: "world-bible", book: draft.worldLorebook }],
  };
}

export async function generateStoryDraft(
  settings: OpenRouterSettings,
  input: StoryDraftInput,
  signal?: AbortSignal,
): Promise<StoryDraft> {
  const lang =
    input.locale === "de"
      ? "German (de). Write character cards and lore in German unless the concept is explicitly English."
      : "English (en). Write character cards and lore in English.";

  const userBrief = [
    `Concept: ${input.concept.trim()}`,
    input.genre?.trim() ? `Genre: ${input.genre.trim()}` : null,
    input.tone?.trim() ? `Tone: ${input.tone.trim()}` : null,
    `Language: ${lang}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await completeOpenRouter(
    settings,
    [
      {
        role: "system",
        content: `You are a story bible designer for an interactive audiobook RPG app (WryTour-style character cards + lorebook).

Design ONE cohesive story package:
- Exactly 1 narrator character (role narrator) with rich system_prompt, first_mes opening scene (800-1500 words for narrator), second-person if appropriate.
- 2-5 cast characters (role cast) for dialogue voice assignment. Each cast card must say they never control other characters.
- World lorebook with 6-10 entries (keys + content) covering setting, rules, factions, protagonist, stakes.
- Slugs: lowercase kebab-case, narrator slug must be "narrator".
- No duplicate slugs. Avoid generic slugs like hidden-community unless it is a real speaking NPC.

Output JSON only matching the schema.`,
      },
      { role: "user", content: userBrief },
    ],
    {
      maxTokens: 8192,
      temperature: 0.75,
      signal,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "story_draft",
          strict: true,
          schema: STORY_DRAFT_SCHEMA as unknown as Record<string, unknown>,
        },
      },
    },
  );

  return parseStoryDraftJson(raw, input.locale);
}
