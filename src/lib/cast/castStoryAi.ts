import { completeOpenRouter } from "@/lib/llm/openrouter";
import { parseModelJson } from "@/lib/llm/parseModelJson";
import { slugifyCharacterName } from "@/lib/memory/characterMemory";
import type { CharacterRow } from "@/lib/db/stories";
import type { OpenRouterSettings, StoryCharacterCard } from "@/lib/types";
import {
  formatSpeakerHintsForPrompt,
  hintToCandidate,
  isThinCharacterCard,
  normalizeCastSlug,
  type SpeakerHint,
  type StoryScanBundle,
} from "@/lib/cast/castStoryContext";

export type StoryCharacterCandidate = {
  slug: string;
  name: string;
  summary: string;
  suggestedMemory: string;
  kind: "new" | "enrich";
  existingId?: string;
  source?: "llm" | "heuristic";
};

export type AdaptedCharacterCard = Pick<
  StoryCharacterCard,
  "name" | "description" | "personality" | "scenario" | "mes_example"
> & {
  character_memory?: string;
};

function parseJson(raw: string): unknown {
  return parseModelJson(raw);
}

const FAMILY_SLUGS = new Set([
  "mother",
  "mutter",
  "mom",
  "mama",
  "father",
  "vater",
  "dad",
  "papa",
  "parents",
  "eltern",
  "sister",
  "schwester",
  "brother",
  "bruder",
]);

function isFamilyHint(h: SpeakerHint): boolean {
  return FAMILY_SLUGS.has(h.castSlug) || /^(npc|guest):(mother|father|mutter|vater|mom|dad)/.test(h.slug);
}

function rosterHasName(existingCast: CharacterRow[], name: string): boolean {
  const n = name.trim().toLowerCase();
  return existingCast.some(
    (c) =>
      c.name.trim().toLowerCase() === n ||
      c.slug === slugifyCharacterName(name) ||
      normalizeCastSlug(c.slug) === normalizeCastSlug(name),
  );
}

function mergeHeuristicCandidates(
  llm: StoryCharacterCandidate[],
  hints: SpeakerHint[],
  existingCast: CharacterRow[],
  locale: "de" | "en",
): StoryCharacterCandidate[] {
  const existingSlugs = new Set(
    existingCast.map((c) => normalizeCastSlug(c.slug)),
  );
  const seen = new Set(llm.map((c) => normalizeCastSlug(c.slug)));
  const merged = [...llm];

  for (const hint of hints) {
    const castSlug = hint.castSlug || slugifyCharacterName(hint.label);
    if (castSlug === "narrator" || existingSlugs.has(castSlug)) continue;
    if (seen.has(castSlug)) continue;

    const recurring = hint.turnCount >= 2 || isFamilyHint(hint);
    if (!recurring) continue;
    if (rosterHasName(existingCast, hint.label)) continue;

    const candidate = hintToCandidate(hint, locale);
    merged.push({ ...candidate, source: "heuristic" });
    seen.add(castSlug);
  }

  return merged.slice(0, 16);
}

export async function discoverCharactersFromStory(
  settings: OpenRouterSettings,
  scan: StoryScanBundle,
  existingCast: CharacterRow[],
  opts?: {
    storyTitle?: string;
    storyConcept?: string | null;
    plotState?: string | null;
    locale?: "de" | "en";
  },
): Promise<StoryCharacterCandidate[]> {
  const transcript = scan.transcript.trim();
  if (!transcript && !scan.speakerHints.length && !scan.plotCharacters.length) {
    return [];
  }

  const locale = opts?.locale ?? "de";
  const roster = existingCast
    .filter((c) => c.role === "cast" || c.role === "narrator")
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      role: c.role,
      thin: isThinCharacterCard(c.card_json.description),
      memory: c.character_memory ?? "",
    }));

  const hintsBlock = formatSpeakerHintsForPrompt(scan.speakerHints);
  const plotNames = scan.plotCharacters.length
    ? scan.plotCharacters.join(", ")
    : null;

  const lang =
    locale === "en"
      ? "Respond in English for name/summary fields."
      : "Antworte auf Deutsch für Name/Zusammenfassung.";

  const raw = await completeOpenRouter(
    settings,
    [
      {
        role: "system",
        content: `You find characters in an interactive audiobook worth adding or enriching in the cast roster.

Return ONLY valid JSON:
{"candidates":[{"slug":"snake_case","name":"Display Name","summary":"1 sentence who they are in THIS story","suggestedMemory":"2-3 sentences: role, relationships, last known state","kind":"new|enrich"}]}

Rules:
- "new" = character in the story but NOT in roster yet.
- "enrich" = already in roster but card is thin/minimal — needs a proper profile.
- Do NOT add the player protagonist (second-person "you") as a cast card.
- INCLUDE recurring family members (Mutter/Mother, Vater/Father, Eltern/Parents) as SEPARATE cards when both appear — role-based names are valid if no proper name exists.
- INCLUDE any speaker from the "Detected speakers" list that is not in the roster.
- INCLUDE named characters from plot state if missing from roster.
- Skip one-off unnamed extras (random guard, passerby with one line).
- Prefer characters who speak or appear across multiple chapters.
- Use existing slugs for enrich candidates.
- Up to 14 candidates, most important first.
- ${lang}
- If none, return {"candidates":[]}.`,
      },
      {
        role: "user",
        content: [
          opts?.storyTitle ? `Story: ${opts.storyTitle}` : null,
          opts?.storyConcept?.trim()
            ? `Concept: ${opts.storyConcept.trim()}`
            : null,
          opts?.plotState?.trim()
            ? `Plot state:\n${opts.plotState.trim()}`
            : null,
          plotNames ? `Plot character names: ${plotNames}` : null,
          hintsBlock ? `Detected speakers (high priority):\n${hintsBlock}` : null,
          `Roster:\n${JSON.stringify(roster, null, 2)}`,
          `Story by chapter (summaries + dialogue):\n${transcript.slice(0, 58000)}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    { maxTokens: 3200, temperature: 0.2 },
  );

  const parsed = parseJson(raw) as {
    candidates?: Array<Partial<StoryCharacterCandidate>>;
  } | null;

  const llmCandidates: StoryCharacterCandidate[] = [];
  const existingSlugs = new Set(existingCast.map((c) => c.slug));
  const bySlug = new Map(existingCast.map((c) => [c.slug, c]));
  const byCastSlug = new Map(
    existingCast.map((c) => [normalizeCastSlug(c.slug), c]),
  );

  for (const c of parsed?.candidates ?? []) {
    const name = c.name?.trim();
    const summary = c.summary?.trim();
    const suggestedMemory = c.suggestedMemory?.trim();
    if (!name || !summary) continue;

    let slug =
      c.slug?.trim().toLowerCase().replace(/_/g, "-") ??
      slugifyCharacterName(name);
    slug = normalizeCastSlug(slug);

    const existing =
      bySlug.get(slug) ??
      byCastSlug.get(slug) ??
      existingCast.find(
        (r) => r.name.trim().toLowerCase() === name.toLowerCase(),
      );
    if (existing) slug = existing.slug;

    const kind =
      c.kind === "enrich" || existing ? ("enrich" as const) : ("new" as const);

    if (kind === "new" && existingSlugs.has(slug)) continue;
    if (kind === "enrich" && !existing) continue;

    llmCandidates.push({
      slug,
      name: existing?.name ?? name,
      summary,
      suggestedMemory: suggestedMemory ?? summary,
      kind,
      existingId: existing?.id,
      source: "llm",
    });
  }

  return mergeHeuristicCandidates(
    llmCandidates,
    scan.speakerHints,
    existingCast,
    locale,
  );
}

export async function adaptCharacterCardWithAi(
  settings: OpenRouterSettings,
  character: CharacterRow,
  transcript: string,
  opts?: {
    storyTitle?: string;
    storyConcept?: string | null;
    plotState?: string | null;
    userInstruction?: string;
    locale?: "de" | "en";
  },
): Promise<AdaptedCharacterCard> {
  const lang =
    opts?.locale === "en"
      ? "Write card fields in English."
      : "Schreibe Kartenfelder auf Deutsch.";

  const raw = await completeOpenRouter(
    settings,
    [
      {
        role: "system",
        content: `You adapt a character card for an interactive audiobook to match the actual story.

Return ONLY valid JSON:
{"name":"...","description":"2-3 sentences appearance/role","personality":"speaking style & traits","scenario":"typical context in story","mes_example":"short example line in quotes","character_memory":"2-4 sentences story-specific memory"}

Rules:
- Cast characters never control other characters — only their own voice when speaking.
- Ground everything in the transcript; do not invent major plot not supported by text.
- Keep mes_example short (one line).
- ${lang}`,
      },
      {
        role: "user",
        content: [
          opts?.storyTitle ? `Story: ${opts.storyTitle}` : null,
          opts?.storyConcept?.trim()
            ? `Concept: ${opts.storyConcept.trim()}`
            : null,
          opts?.plotState?.trim()
            ? `Plot state:\n${opts.plotState.trim()}`
            : null,
          opts?.userInstruction?.trim()
            ? `User instruction: ${opts.userInstruction.trim()}`
            : null,
          `Character slug: ${character.slug}, role: ${character.role}`,
          `Current card:\n${JSON.stringify(character.card_json, null, 2)}`,
          character.character_memory?.trim()
            ? `Current memory:\n${character.character_memory.trim()}`
            : null,
          `Transcript excerpt:\n${transcript.slice(0, 48000)}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    { maxTokens: 1800, temperature: 0.35 },
  );

  const parsed = parseJson(raw) as Partial<AdaptedCharacterCard> | null;
  if (!parsed?.name?.trim()) {
    throw new Error("KI-Antwort konnte nicht gelesen werden.");
  }

  return {
    name: parsed.name.trim(),
    description: parsed.description?.trim() ?? "",
    personality: parsed.personality?.trim() ?? "",
    scenario: parsed.scenario?.trim() ?? "",
    mes_example: parsed.mes_example?.trim() ?? "",
    character_memory: parsed.character_memory?.trim(),
  };
}
