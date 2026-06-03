import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { StoryDraft, StoryDraftInput } from "@/lib/story/generateStoryDraft";
import { parseStoryDraftJson } from "@/lib/story/generateStoryDraft";
import type { OpenRouterSettings, StoryCharacterCard } from "@/lib/types";

export type CharacterCardField = keyof Pick<
  StoryCharacterCard,
  | "name"
  | "description"
  | "personality"
  | "scenario"
  | "first_mes"
  | "mes_example"
  | "creator_notes"
  | "system_prompt"
  | "post_history_instructions"
>;

export type StoryFieldPath =
  | { scope: "meta"; field: "storyTitle" | "bandTitle" | "chapterTitle" | "phaseHint" }
  | { scope: "lore"; field: "name" | "description" }
  | { scope: "loreEntry"; index: number; field: "keys" | "content" | "comment" }
  | { scope: "character"; index: number; field: "slug" }
  | { scope: "characterCard"; index: number; field: CharacterCardField };

export interface EditorBrief {
  concept: string;
  locale: "de" | "en";
  genre?: string;
  tone?: string;
  draft: StoryDraft | null;
  /** Unmodified template copy for “based on” remixes */
  templateBase?: StoryDraft | null;
  templateLabel?: string;
}

export type TemplateRemixAspect =
  | "intro"
  | "mood"
  | "characters"
  | "lore"
  | "meta";

export const TEMPLATE_REMIX_LABELS: Record<TemplateRemixAspect, string> = {
  intro: "Intro / Eröffnung (Narrator)",
  mood: "Stimmung & Erzählton",
  characters: "Charaktere (Karten)",
  lore: "Welt & Lorebook",
  meta: "Titel (Story, Band, Kapitel)",
};

export const DEFAULT_REMIX_ASPECTS: Record<TemplateRemixAspect, boolean> = {
  intro: false,
  mood: false,
  characters: false,
  lore: false,
  meta: false,
};

const CARD_FIELD_HINTS: Record<CharacterCardField, string> = {
  name: "Display name of the character",
  description: "Physical traits, role, backstory summary (2-4 sentences)",
  personality: "Personality traits and speech style",
  scenario: "Current story situation for this character",
  first_mes:
    "Opening message or scene beat. Narrator: long immersive second-person scene. Cast: in-character dialogue/actions only.",
  mes_example: "Example message exchange (optional)",
  creator_notes: "Notes for the human author (not shown in chat)",
  system_prompt:
    "System instructions for the LLM when this character speaks. Cast must never control other characters.",
  post_history_instructions:
    "Short reminders appended after chat history",
};

function langLine(locale: "de" | "en"): string {
  return locale === "de"
    ? "Write in German unless the concept is explicitly English."
    : "Write in English.";
}

export function summarizeTemplateDraft(d: StoryDraft): string {
  const narrator = d.characters.find((c) => c.role === "narrator");
  return JSON.stringify(
    {
      meta: {
        storyTitle: d.storyTitle,
        bandTitle: d.bandTitle,
        chapterTitle: d.chapterTitle,
        phaseHint: d.phaseHint,
      },
      lore: {
        name: d.worldLorebook.name,
        entryCount: d.worldLorebook.entries.length,
        sampleEntries: d.worldLorebook.entries.slice(0, 4).map((e) => ({
          keys: e.keys,
          content: e.content.slice(0, 200),
        })),
      },
      characters: d.characters.map((c) => ({
        slug: c.slug,
        role: c.role,
        name: c.card.name,
        personality: c.card.personality?.slice(0, 160),
      })),
      narratorOpening: narrator?.card.first_mes?.slice(0, 800),
    },
    null,
    2,
  );
}

function templateContextBlock(brief: EditorBrief): string {
  if (!brief.templateBase || !brief.templateLabel) return "";
  return [
    "",
    `REFERENCE TEMPLATE: “${brief.templateLabel}”`,
    "Adapt this reference according to the user's concept. Keep character slugs unless the concept requires renaming.",
    summarizeTemplateDraft(brief.templateBase),
  ].join("\n");
}

function briefContext(brief: EditorBrief): string {
  const d = brief.draft;
  const castNames =
    d?.characters
      .filter((c) => c.role === "cast")
      .map((c) => c.card.name)
      .join(", ") || "—";
  return [
    `Story concept: ${brief.concept.trim() || "(not set yet)"}`,
    brief.genre?.trim() ? `Genre: ${brief.genre.trim()}` : null,
    brief.tone?.trim() ? `Tone: ${brief.tone.trim()}` : null,
    langLine(brief.locale),
    d
      ? [
          `Current story title: ${d.storyTitle || "—"}`,
          `Band: ${d.bandTitle}`,
          `Chapter: ${d.chapterTitle}`,
          `Lorebook: ${d.worldLorebook.name} (${d.worldLorebook.entries.length} entries)`,
          `Cast: ${castNames}`,
        ].join("\n")
      : "No draft saved yet.",
    templateContextBlock(brief),
  ]
    .filter(Boolean)
    .join("\n");
}

export function emptyStoryDraft(locale: "de" | "en"): StoryDraft {
  return {
    storyTitle: "",
    locale,
    bandTitle: "",
    chapterTitle: "",
    phaseHint: "",
    worldLorebook: {
      name: "",
      description: "",
      entries: [],
    },
    characters: [],
  };
}

export function fieldPathKey(path: StoryFieldPath): string {
  if (path.scope === "meta") return `meta.${path.field}`;
  if (path.scope === "lore") return `lore.${path.field}`;
  if (path.scope === "loreEntry") return `lore.${path.index}.${path.field}`;
  if (path.scope === "character") return `char.${path.index}.slug`;
  return `char.${path.index}.${path.field}`;
}

export function getFieldValue(draft: StoryDraft, path: StoryFieldPath): string {
  switch (path.scope) {
    case "meta":
      return (draft[path.field] as string | undefined) ?? "";
    case "lore":
      return (draft.worldLorebook[path.field] as string | undefined) ?? "";
    case "loreEntry": {
      const e = draft.worldLorebook.entries[path.index];
      if (!e) return "";
      if (path.field === "keys") return e.keys.join(", ");
      return (e[path.field] as string | undefined) ?? "";
    }
    case "character":
      return draft.characters[path.index]?.slug ?? "";
    case "characterCard":
      return (
        (draft.characters[path.index]?.card[path.field] as string | undefined) ??
        ""
      );
  }
}

export function setFieldValue(
  draft: StoryDraft,
  path: StoryFieldPath,
  value: string,
): StoryDraft {
  const next = structuredClone(draft);
  switch (path.scope) {
    case "meta":
      next[path.field] = value;
      break;
    case "lore":
      next.worldLorebook[path.field] = value;
      break;
    case "loreEntry": {
      while (next.worldLorebook.entries.length <= path.index) {
        next.worldLorebook.entries.push({
          keys: [],
          content: "",
          comment: "",
          order: (next.worldLorebook.entries.length + 1) * 10,
          position: 0,
          enabled: true,
        });
      }
      const entry = next.worldLorebook.entries[path.index];
      if (path.field === "keys") {
        entry.keys = value
          .split(/[,;]+/)
          .map((k) => k.trim())
          .filter(Boolean);
      } else {
        entry[path.field] = value;
      }
      break;
    }
    case "character":
      if (!next.characters[path.index]) break;
      next.characters[path.index].slug = value;
      break;
    case "characterCard":
      if (!next.characters[path.index]) break;
      next.characters[path.index].card[path.field] = value;
      break;
  }
  return next;
}

function fieldInstruction(path: StoryFieldPath, current: string): string {
  const empty = !current.trim();
  const mode = empty ? "Generate" : "Randomize (invent a fresh alternative)";
  if (path.scope === "meta") {
    const labels: Record<string, string> = {
      storyTitle: "story title",
      bandTitle: "volume/band title",
      chapterTitle: "first chapter title",
      phaseHint: "phase hint for pacing (e.g. Act I — Discovery)",
    };
    return `${mode} the ${labels[path.field]}. One line, evocative, genre-appropriate.`;
  }
  if (path.scope === "lore") {
    return path.field === "name"
      ? `${mode} the world bible / lorebook title.`
      : `${mode} a one-paragraph lorebook description.`;
  }
  if (path.scope === "loreEntry") {
    if (path.field === "keys")
      return `${mode} trigger keywords (comma-separated, 2-6 items) for lore entry #${path.index + 1}.`;
    if (path.field === "content")
      return `${mode} lore entry body (3-6 sentences, factual worldbuilding).`;
    return `${mode} short author comment for this lore entry.`;
  }
  if (path.scope === "character") {
    return `${mode} URL slug (lowercase kebab-case) for character #${path.index + 1}.`;
  }
  const ch = path as { index: number; field: CharacterCardField };
  const hint = CARD_FIELD_HINTS[ch.field];
  return `${mode} character card field "${ch.field}" (${hint}).`;
}

export async function randomizeStoryField(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  path: StoryFieldPath,
  signal?: AbortSignal,
): Promise<string> {
  const draft = brief.draft ?? emptyStoryDraft(brief.locale);
  const current = getFieldValue(draft, path);
  const instruction = fieldInstruction(path, current);

  let charRole = "";
  if (path.scope === "characterCard" || path.scope === "character") {
    const c = draft.characters[path.index];
    charRole = c
      ? `${c.role} — ${c.card.name || c.slug}`
      : `new character slot ${path.index + 1}`;
  }

  const raw = await completeOpenRouter(
    settings,
    [
      {
        role: "system",
        content: `You help author interactive audiobook story bibles (HörbuchKI story format).
${instruction}
Stay consistent with the story concept and existing draft.
Be creative when randomizing — surprise the author but keep internal logic.
Return JSON only: {"value":"..."} with a single string in "value".
For keyword lists, put comma-separated keywords in "value".`,
      },
      {
        role: "user",
        content: [
          briefContext(brief),
          charRole ? `Target character: ${charRole}` : null,
          current.trim()
            ? `Current value:\n${current}`
            : "Current value: (empty)",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    {
      maxTokens: path.scope === "characterCard" && path.field === "first_mes" ? 4096 : 1024,
      temperature: 1.05,
      signal,
      responseFormat: { type: "json_object" },
    },
  );

  try {
    const parsed = JSON.parse(raw) as { value?: string };
    if (typeof parsed.value === "string") return parsed.value.trim();
  } catch {
    /* fallback */
  }
  return raw.replace(/^["']|["']$/g, "").trim();
}

export async function randomizeConceptField(
  settings: OpenRouterSettings,
  brief: Omit<EditorBrief, "draft"> & { field: "concept" | "genre" | "tone" },
  current: string,
  signal?: AbortSignal,
): Promise<string> {
  const labels = {
    concept: "story concept pitch (3-6 sentences: setting, protagonist, conflict, hook)",
    genre: "genre label (1-4 words)",
    tone: "tone/mood label (1-6 words)",
  };
  const empty = !current.trim();
  const raw = await completeOpenRouter(
    settings,
    [
      {
        role: "system",
        content: `${empty ? "Generate" : "Randomize"} ${labels[brief.field]} for an interactive audiobook.
${langLine(brief.locale)}
Return JSON: {"value":"..."}`,
      },
      {
        role: "user",
        content: [
          brief.concept.trim() && brief.field !== "concept"
            ? `Concept: ${brief.concept}`
            : null,
          current.trim() ? `Current:\n${current}` : "Current: (empty)",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    { maxTokens: brief.field === "concept" ? 512 : 128, temperature: 1.05, signal, responseFormat: { type: "json_object" } },
  );
  try {
    const parsed = JSON.parse(raw) as { value?: string };
    if (typeof parsed.value === "string") return parsed.value.trim();
  } catch {
    /* */
  }
  return raw.trim();
}

const META_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["storyTitle", "bandTitle", "chapterTitle"],
  properties: {
    storyTitle: { type: "string" },
    bandTitle: { type: "string" },
    chapterTitle: { type: "string" },
    phaseHint: { type: "string" },
  },
} as const;

const LORE_SCHEMA = {
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
          keys: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
          content: { type: "string" },
          comment: { type: "string" },
        },
      },
    },
  },
} as const;

const CHARACTERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["characters"],
  properties: {
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
              system_prompt: { type: "string" },
              post_history_instructions: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

async function completeJson<T>(
  settings: OpenRouterSettings,
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<T> {
  const raw = await completeOpenRouter(
    settings,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      maxTokens,
      temperature: 0.8,
      signal,
      responseFormat: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
    },
  );
  return JSON.parse(raw) as T;
}

export async function generateStoryMetaOnly(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  signal?: AbortSignal,
): Promise<Pick<StoryDraft, "storyTitle" | "bandTitle" | "chapterTitle" | "phaseHint">> {
  const meta = await completeJson<{
    storyTitle: string;
    bandTitle: string;
    chapterTitle: string;
    phaseHint?: string;
  }>(
    settings,
    `Design story metadata (titles only) for an interactive audiobook. ${langLine(brief.locale)}`,
    briefContext(brief),
    "story_meta",
    META_SCHEMA as unknown as Record<string, unknown>,
    512,
    signal,
  );
  return {
    storyTitle: meta.storyTitle.trim(),
    bandTitle: meta.bandTitle.trim(),
    chapterTitle: meta.chapterTitle.trim(),
    phaseHint: meta.phaseHint?.trim(),
  };
}

export async function generateWorldLorebookOnly(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  signal?: AbortSignal,
): Promise<StoryDraft["worldLorebook"]> {
  const lore = await completeJson<{
    name: string;
    description?: string;
    entries: Array<{ keys: string[]; content: string; comment?: string }>;
  }>(
    settings,
    `Design a world bible lorebook (6-10 entries) for an interactive audiobook. ${langLine(brief.locale)}`,
    briefContext(brief),
    "world_lore",
    LORE_SCHEMA as unknown as Record<string, unknown>,
    4096,
    signal,
  );
  return {
    name: lore.name.trim() || "World Bible",
    description: lore.description,
    entries: lore.entries.map((e, idx) => ({
      keys: e.keys.map((k) => k.trim()).filter(Boolean),
      content: e.content.trim(),
      comment: e.comment,
      order: (idx + 1) * 10,
      position: 0,
      enabled: true,
    })),
  };
}

export async function generateCharactersOnly(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  signal?: AbortSignal,
): Promise<StoryDraft["characters"]> {
  const result = await completeJson<{
    characters: StoryDraft["characters"];
  }>(
    settings,
    `Design character cards: exactly 1 narrator (slug "narrator") + 2-5 cast.
Narrator: rich first_mes opening scene. Cast: never control other characters.
${langLine(brief.locale)}`,
    briefContext(brief),
    "story_characters",
    CHARACTERS_SCHEMA as unknown as Record<string, unknown>,
    8192,
    signal,
  );
  const parsed = parseStoryDraftJson(
    JSON.stringify({
      storyTitle: brief.draft?.storyTitle ?? "Draft",
      bandTitle: brief.draft?.bandTitle ?? "Band I",
      chapterTitle: brief.draft?.chapterTitle ?? "Kapitel 1",
      worldLorebook: brief.draft?.worldLorebook ?? { name: "World", entries: [{ keys: ["world"], content: "..." }] },
      characters: result.characters,
    }),
    brief.locale,
  );
  return parsed.characters;
}

export function mergeDraftMeta(
  draft: StoryDraft,
  meta: Partial<Pick<StoryDraft, "storyTitle" | "bandTitle" | "chapterTitle" | "phaseHint">>,
): StoryDraft {
  return { ...draft, ...meta };
}

const INTRO_REMIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["first_mes"],
  properties: { first_mes: { type: "string" } },
} as const;

const MOOD_REMIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tone", "updates"],
  properties: {
    tone: { type: "string" },
    updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "personality"],
        properties: {
          slug: { type: "string" },
          personality: { type: "string" },
          description: { type: "string" },
          post_history_instructions: { type: "string" },
        },
      },
    },
  },
} as const;

function findNarratorIndex(draft: StoryDraft): number {
  return draft.characters.findIndex((c) => c.role === "narrator");
}

export async function remixTemplateIntro(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  signal?: AbortSignal,
): Promise<string> {
  const draft = brief.draft;
  if (!draft) throw new Error("No draft loaded");
  const idx = findNarratorIndex(draft);
  if (idx < 0) throw new Error("Narrator missing");

  const result = await completeJson<{ first_mes: string }>(
    settings,
    `Rewrite the narrator opening scene (first_mes) for an interactive audiobook.
Keep the same cast and premise as the reference template unless the user's concept clearly changes them.
${langLine(brief.locale)}
Length: similar to template (rich, immersive). End at a natural pause for the player.`,
    [
      briefContext(brief),
      `Current first_mes excerpt:\n${draft.characters[idx].card.first_mes?.slice(0, 1200) ?? "(empty)"}`,
      `User wants a new opening aligned with concept + tone.`,
    ].join("\n\n"),
    "remix_intro",
    INTRO_REMIX_SCHEMA as unknown as Record<string, unknown>,
    4096,
    signal,
  );
  return result.first_mes.trim();
}

export async function remixTemplateMood(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  signal?: AbortSignal,
): Promise<{ tone: string; draft: StoryDraft }> {
  const draft = brief.draft;
  if (!draft) throw new Error("No draft loaded");

  const result = await completeJson<{
    tone: string;
    updates: Array<{
      slug: string;
      personality: string;
      description?: string;
      post_history_instructions?: string;
    }>;
  }>(
    settings,
    `Adjust story mood and voice across characters for an interactive audiobook.
Return a short tone label and per-character personality updates (by slug).
Narrator: shift narrative voice. Cast: shift how they speak/feel, not plot roles.
${langLine(brief.locale)}`,
    briefContext(brief),
    "remix_mood",
    MOOD_REMIX_SCHEMA as unknown as Record<string, unknown>,
    2048,
    signal,
  );

  const next = structuredClone(draft);
  for (const u of result.updates) {
    const ch = next.characters.find((c) => c.slug === u.slug);
    if (!ch) continue;
    ch.card.personality = u.personality.trim();
    if (u.description?.trim()) ch.card.description = u.description.trim();
    if (u.post_history_instructions?.trim()) {
      ch.card.post_history_instructions = u.post_history_instructions.trim();
    }
  }
  const narrIdx = findNarratorIndex(next);
  if (narrIdx >= 0 && result.updates.length === 0) {
    /* ensure narrator touched if model forgot updates */
  }
  return { tone: result.tone.trim(), draft: next };
}

export async function remixTemplateCharacters(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  signal?: AbortSignal,
): Promise<StoryDraft["characters"]> {
  const slugs = brief.draft?.characters.map((c) => c.slug).join(", ") ?? "";
  const result = await completeJson<{ characters: StoryDraft["characters"] }>(
    settings,
    `Rewrite character cards for an interactive audiobook based on the reference template.
Keep the SAME slugs and roles: ${slugs}.
Exactly one narrator (slug narrator). Cast must never control other characters.
${langLine(brief.locale)}`,
    [
      briefContext(brief),
      "Rewrite all character cards to fit the user concept while preserving cast structure from the template.",
    ].join("\n\n"),
    "remix_characters",
    CHARACTERS_SCHEMA as unknown as Record<string, unknown>,
    8192,
    signal,
  );
  const parsed = parseStoryDraftJson(
    JSON.stringify({
      storyTitle: brief.draft?.storyTitle ?? "Draft",
      bandTitle: brief.draft?.bandTitle ?? "Band I",
      chapterTitle: brief.draft?.chapterTitle ?? "Kapitel 1",
      worldLorebook: brief.draft?.worldLorebook ?? {
        name: "World",
        entries: [{ keys: ["world"], content: "..." }],
      },
      characters: result.characters,
    }),
    brief.locale,
  );
  return parsed.characters;
}

export interface RemixTemplateResult {
  draft: StoryDraft;
  tone?: string;
}

export async function remixTemplateAspects(
  settings: OpenRouterSettings,
  brief: EditorBrief,
  aspects: TemplateRemixAspect[],
  signal?: AbortSignal,
): Promise<RemixTemplateResult> {
  if (!brief.draft) throw new Error("No draft loaded");
  if (!brief.templateBase) throw new Error("No template reference loaded");
  if (!aspects.length) throw new Error("Select at least one aspect to remix");

  let draft = structuredClone(brief.draft);
  let tone: string | undefined;

  const ctx: EditorBrief = { ...brief, draft };

  for (const aspect of aspects) {
    if (aspect === "intro") {
      const first_mes = await remixTemplateIntro(settings, ctx, signal);
      const idx = findNarratorIndex(draft);
      if (idx >= 0) draft.characters[idx].card.first_mes = first_mes;
    } else if (aspect === "mood") {
      const mood = await remixTemplateMood(settings, { ...ctx, draft }, signal);
      draft = mood.draft;
      tone = mood.tone;
    } else if (aspect === "characters") {
      const characters = await remixTemplateCharacters(
        settings,
        { ...ctx, draft },
        signal,
      );
      draft = { ...draft, characters };
    } else if (aspect === "lore") {
      const worldLorebook = await generateWorldLorebookOnly(
        settings,
        { ...ctx, draft },
        signal,
      );
      draft = { ...draft, worldLorebook };
    } else if (aspect === "meta") {
      const meta = await generateStoryMetaOnly(
        settings,
        { ...brief, draft },
        signal,
      );
      draft = mergeDraftMeta(draft, meta);
    }
    ctx.draft = draft;
  }

  return { draft, tone };
}
