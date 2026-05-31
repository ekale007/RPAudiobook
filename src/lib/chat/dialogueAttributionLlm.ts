import { extractMarkedSnippets } from "@/lib/chat/dialogueSpeakerInference";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import type { CharacterRow } from "@/lib/db/stories";
import { completeOpenRouter } from "@/lib/llm/openrouter";
import type { OpenRouterSettings } from "@/lib/types";

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

function buildCastSlugList(cast: CharacterRow[]): string {
  const castSlugs = cast
    .filter((c) => c.role === "cast" && (c.status ?? "active") === "active")
    .map((c) => `- ${c.slug} (${c.name})`);
  return [
    "- narrator (scene description + protagonist Elias/Guardian speaking)",
    ...castSlugs,
    "- guest:<name> for one-off speakers (lowercase, e.g. guest:sera, guest:zarek)",
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

/** Match LLM snippet to an extracted quote (exact or inner-text fallback). */
function matchSnippetToExtracted(
  llmSnippet: string,
  extracted: string[],
): string | null {
  const t = llmSnippet.trim();
  if (!t) return null;
  if (extracted.includes(t)) return t;

  const inner = t.replace(/^["“”']|["“”']$/g, "").trim();
  for (const e of extracted) {
    const eInner = e.replace(/^["“”']|["“”']$/g, "").trim();
    if (eInner === inner || e.includes(inner) || inner.includes(eInner)) {
      return e;
    }
  }
  return null;
}

function normalizeLlmSlug(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s === "narrator" || s === "protagonist" || s === "elias") {
    return "narrator";
  }
  if (s.startsWith("guest:") || s.startsWith("npc:")) return s;
  return s.replace(/\s+/g, "-");
}

export async function attributeDialogueWithLlm(
  rawContent: string,
  cast: CharacterRow[],
  settings: OpenRouterSettings,
  signal?: AbortSignal,
): Promise<LlmAttributionMap> {
  const text = stripSpeakerTags(rawContent);
  const snippets = extractMarkedSnippets(text);
  const out: LlmAttributionMap = new Map();

  if (!snippets.length) return out;

  const snippetList = snippets
    .map((s, i) => `[${i + 1}] ${s.replace(/\s+/g, " ").slice(0, 220)}`)
    .join("\n");

  const system = `You assign speakers to quoted dialogue in interactive fiction (second-person, protagonist = Elias/Guardian).

Return JSON only:
{
  "attributions": [
    { "snippet": "<exact quote from list>", "speaker_slug": "<slug>", "reason": "<short>" }
  ]
}

Rules:
- Protagonist (Elias/Guardian/"You" speaking) → narrator
- Use cast slugs exactly when a cast member speaks
- One-off named characters → guest:<firstname lowercase>
- Family roles → npc:mother etc.
- "she teases" / "Naya laughs" before a quote → that character, not narrator
- A paragraph may alternate speakers; each quote gets its own speaker
- snippet must copy the quote text exactly from the input list`;

  const user = `Cast slugs:
${buildCastSlugList(cast)}

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
      signal,
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
