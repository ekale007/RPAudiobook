import { extractMarkedSnippets } from "@/lib/chat/dialogueQuotes";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import type { CharacterRow } from "@/lib/db/stories";
import { completeOpenRouter } from "@/lib/llm/openrouter";
import {
  PROTAGONIST_SPEAKER_SLUG,
  type StoryContentLocale,
} from "@/lib/story/protagonist";
import type { OpenRouterSettings, StoryProtagonistProfile } from "@/lib/types";

export type LlmAttributionEntry = {
  slug: string;
  reasons: string[];
};

export type LlmAttributionMap = Map<string, LlmAttributionEntry>;

type LlmAttributionResponse = {
  attributions?: Array<{
    snippet?: string;
    speaker_slug?: string;
    reason?: string;
  }>;
};

function buildCastSlugList(
  cast: CharacterRow[],
  locale: StoryContentLocale,
): string {
  const castSlugs = cast
    .filter((c) => c.role === "cast" && (c.status ?? "active") === "active")
    .map((c) => `- ${c.slug} (${c.name})`);
  const narratorLine =
    locale === "de"
      ? "- narrator (nur Erzähltext, keine Dialogzeilen)"
      : "- narrator (scene description only, not character dialogue)";
  const protagonistLine =
    locale === "de"
      ? `- ${PROTAGONIST_SPEAKER_SLUG} (Spieler / Protagonist spricht)`
      : `- ${PROTAGONIST_SPEAKER_SLUG} (player protagonist speaking)`;
  return [
    narratorLine,
    protagonistLine,
    ...castSlugs,
    "- guest:<name> for one-off speakers (lowercase)",
    "- npc:mother, npc:father, npc:sister, npc:brother for family roles",
  ].join("\n");
}

function parseLlmAttributionJson(raw: string): LlmAttributionResponse | null {
  const trimmed = raw.trim();
  const block = trimmed.match(/\{[\s\S]*\}/);
  if (!block) return null;
  try {
    return JSON.parse(block[0]) as LlmAttributionResponse;
  } catch {
    return null;
  }
}

function matchSnippetToExtracted(
  llmSnippet: string,
  extracted: string[],
): string | null {
  const t = llmSnippet.trim();
  if (!t) return null;
  if (extracted.includes(t)) return t;

  const inner = t.replace(/^["“”'„»«]|["“”'„»«]$/g, "").trim();
  for (const e of extracted) {
    const eInner = e.replace(/^["“”'„»«]|["“”'„»«]$/g, "").trim();
    if (eInner === inner || e.includes(inner) || inner.includes(eInner)) {
      return e;
    }
  }
  return null;
}

function normalizeLlmSlug(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s === "narrator") return "narrator";
  if (
    s === PROTAGONIST_SPEAKER_SLUG ||
    s === "protagonist" ||
    s === "player" ||
    s === "elias" ||
    s === "du" ||
    s === "you"
  ) {
    return PROTAGONIST_SPEAKER_SLUG;
  }
  if (s.startsWith("guest:") || s.startsWith("npc:")) return s;
  return s.replace(/\s+/g, "-");
}

export async function attributeDialogueWithLlm(
  rawContent: string,
  cast: CharacterRow[],
  settings: OpenRouterSettings,
  options?: {
    locale?: StoryContentLocale;
    protagonist?: StoryProtagonistProfile | null;
    signal?: AbortSignal;
  },
): Promise<LlmAttributionMap> {
  const locale = options?.locale ?? "en";
  const text = stripSpeakerTags(rawContent);
  const snippets = extractMarkedSnippets(text, locale);
  const out: LlmAttributionMap = new Map();

  if (!snippets.length) return out;

  const snippetList = snippets
    .map((s, i) => `[${i + 1}] ${s.replace(/\s+/g, " ").slice(0, 220)}`)
    .join("\n");

  const playerName =
    options?.protagonist?.displayName?.trim() ||
    (locale === "de" ? "Spieler" : "player");

  const system =
    locale === "de"
      ? `Du ordnest zitierte Dialogzeilen in interaktiver Literatur (Zweite Person, Protagonist = ${playerName}) Sprechern zu.

Nur JSON:
{
  "attributions": [
    { "snippet": "<exaktes Zitat aus der Liste>", "speaker_slug": "<slug>", "reason": "<kurz>" }
  ]
}

Regeln:
- Protagonist / „du“ spricht → ${PROTAGONIST_SPEAKER_SLUG}
- Erzähltext ohne Figur → narrator (selten bei Zitaten)
- Cast-Slugs exakt wenn eine Cast-Figur spricht
- Einmalige Namen → guest:<name>
- Familie → npc:mother usw.
- „sagte sie“ / „flüsterte er“ vor dem Zitat → diese Figur
- snippet muss exakt aus der Liste kopiert werden`
      : `You assign speakers to quoted dialogue in interactive fiction (second person, protagonist = ${playerName}).

Return JSON only:
{
  "attributions": [
    { "snippet": "<exact quote from list>", "speaker_slug": "<slug>", "reason": "<short>" }
  ]
}

Rules:
- Player / "you" speaking → ${PROTAGONIST_SPEAKER_SLUG}
- Cast slugs exactly when a cast member speaks
- One-off named characters → guest:<firstname lowercase>
- Family roles → npc:mother etc.
- "she says" / name before a quote → that character
- snippet must copy the quote text exactly from the input list`;

  const user = `Cast slugs:
${buildCastSlugList(cast, locale)}

Quotes to attribute:
${snippetList}

Scene (for context):
${text.slice(0, 12000)}`;

  const raw = await completeOpenRouter(
    settings,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      maxTokens: 2048,
      temperature: 0.15,
      signal: options?.signal,
      responseFormat: { type: "json_object" },
    },
  );

  const parsed = parseLlmAttributionJson(raw);
  if (!parsed?.attributions?.length) return out;

  const used = new Set<string>();
  for (const row of parsed.attributions) {
    const snippetRaw = row.snippet?.trim();
    const slug = normalizeLlmSlug(row.speaker_slug ?? "narrator");
    if (!snippetRaw) continue;

    const matched = matchSnippetToExtracted(snippetRaw, snippets);
    if (!matched || used.has(matched)) continue;
    used.add(matched);

    out.set(matched, {
      slug,
      reasons: ["llm_attribution", row.reason ?? "model"].slice(0, 3),
    });
  }

  return out;
}
