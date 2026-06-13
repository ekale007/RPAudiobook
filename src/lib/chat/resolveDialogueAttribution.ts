import {
  attributeDialogueWithLlm,
  type LlmAttributionMap,
} from "@/lib/chat/dialogueAttributionLlm";
import { buildDialogueAttributionMap } from "@/lib/chat/dialogueScript";
import { extractMarkedSnippets } from "@/lib/chat/dialogueQuotes";
import { assistantTurnProseText } from "@/lib/chat/parseSpeakerBlocks";
import type { CharacterRow } from "@/lib/db/stories";
import {
  normalizeStoryContentLocale,
  type StoryContentLocale,
} from "@/lib/story/protagonist";
import { loadOpenRouterSettings, isLlmReady } from "@/lib/storage/openRouterSettings";
import {
  hashTurnContent,
  loadDialogueAttributionCache,
  saveDialogueAttributionCache,
} from "@/lib/storage/dialogueAttributionCache";
import type { OpenRouterSettings, StoryProtagonistProfile } from "@/lib/types";

const inflight = new Map<string, Promise<LlmAttributionMap | null>>();

export type DialogueAttributionOptions = {
  locale?: StoryContentLocale | string | null;
  protagonist?: StoryProtagonistProfile | null;
};

function cacheToMap(
  cached: NonNullable<ReturnType<typeof loadDialogueAttributionCache>>,
): LlmAttributionMap {
  const map: LlmAttributionMap = new Map();
  for (const [snippet, slug] of Object.entries(cached.attributions)) {
    map.set(snippet, {
      slug,
      reasons: cached.reasons?.[snippet] ?? ["llm_attribution", "cached"],
    });
  }
  return map;
}

function saveMapToCache(
  turnId: string,
  content: string,
  map: LlmAttributionMap,
): void {
  if (!map.size) return;
  const attributions: Record<string, string> = {};
  const reasons: Record<string, string[]> = {};
  for (const [snippet, entry] of map.entries()) {
    attributions[snippet] = entry.slug;
    reasons[snippet] = entry.reasons;
  }
  saveDialogueAttributionCache(turnId, {
    contentHash: hashTurnContent(content),
    attributions,
    reasons,
    source: "llm",
    cachedAt: new Date().toISOString(),
  });
}

export async function ensureDialogueAttribution(
  turnId: string,
  content: string,
  cast: CharacterRow[],
  settings?: OpenRouterSettings | null,
  options?: DialogueAttributionOptions,
): Promise<LlmAttributionMap | null> {
  if (!content.trim() || turnId.startsWith("tmp-")) return null;

  const locale = normalizeStoryContentLocale(options?.locale ?? "en");

  const cached = loadDialogueAttributionCache(turnId, content);
  if (cached) return cacheToMap(cached);

  const orSettings = settings ?? loadOpenRouterSettings();
  if (!orSettings) return null;
  if (!isLlmReady() && !orSettings.apiKey?.trim()) return null;

  const prose = assistantTurnProseText(content);
  const snippets = extractMarkedSnippets(prose, locale);
  if (!snippets.length) return null;

  const flightKey = `${turnId}:${hashTurnContent(content)}:${locale}`;
  const pending = inflight.get(flightKey);
  if (pending) return pending;

  const work = attributeDialogueWithLlm(content, cast, orSettings, {
    locale,
    protagonist: options?.protagonist,
  })
    .then((map) => {
      if (map.size) saveMapToCache(turnId, content, map);
      return map.size ? map : null;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(flightKey);
    });

  inflight.set(flightKey, work);
  return work;
}

export function buildSegmentOverrides(
  rawContent: string,
  cast: CharacterRow[],
  llmMap: LlmAttributionMap | null | undefined,
  locale: StoryContentLocale = "en",
): Record<string, string> {
  const attribution = buildDialogueAttributionMap(
    rawContent,
    cast,
    llmMap ?? undefined,
    locale,
  );
  const out: Record<string, string> = {};
  for (const [snippet, slug] of attribution.entries()) {
    if (slug && slug !== "narrator") out[snippet] = slug;
  }
  return out;
}

export async function resolveSegmentOverridesForTurn(
  turnId: string,
  rawContent: string,
  cast: CharacterRow[],
  options?: DialogueAttributionOptions,
): Promise<Record<string, string>> {
  const locale = normalizeStoryContentLocale(options?.locale ?? "en");
  const llm = await ensureDialogueAttribution(
    turnId,
    rawContent,
    cast,
    undefined,
    options,
  );
  return buildSegmentOverrides(rawContent, cast, llm, locale);
}

export function prefetchDialogueAttributionBatch(
  turns: Array<{ id: string; content: string; role: string }>,
  cast: CharacterRow[],
  options?: DialogueAttributionOptions,
): void {
  const settings = loadOpenRouterSettings();
  if (!isLlmReady() && !settings?.apiKey?.trim()) return;
  for (const t of turns) {
    if (t.role !== "assistant" || t.id.startsWith("tmp-")) continue;
    void ensureDialogueAttribution(t.id, t.content, cast, settings, options);
  }
}
