import {
  attributeDialogueWithLlm,
  type LlmAttributionMap,
} from "@/lib/chat/dialogueAttributionLlm";
import { buildDialogueAttributionMap } from "@/lib/chat/dialogueScript";
import { extractMarkedSnippets } from "@/lib/chat/dialogueSpeakerInference";
import type { CharacterRow } from "@/lib/db/stories";
import { loadOpenRouterSettings, isLlmReady } from "@/lib/storage/openRouterSettings";
import {
  hashTurnContent,
  loadDialogueAttributionCache,
  saveDialogueAttributionCache,
} from "@/lib/storage/dialogueAttributionCache";
import type { OpenRouterSettings } from "@/lib/types";

const inflight = new Map<string, Promise<LlmAttributionMap | null>>();

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

/**
 * Resolve dialogue speakers for a turn (cache → LLM → heuristics-only map).
 * Safe to call multiple times; dedupes in-flight requests.
 */
export async function ensureDialogueAttribution(
  turnId: string,
  content: string,
  cast: CharacterRow[],
  settings?: OpenRouterSettings | null,
): Promise<LlmAttributionMap | null> {
  if (!content.trim() || turnId.startsWith("tmp-")) return null;

  const cached = loadDialogueAttributionCache(turnId, content);
  if (cached) return cacheToMap(cached);

  const orSettings = settings ?? loadOpenRouterSettings();
  if (!orSettings) return null;
  if (!isLlmReady() && !orSettings.apiKey?.trim()) return null;

  const snippets = extractMarkedSnippets(content);
  if (!snippets.length) return null;

  const flightKey = `${turnId}:${hashTurnContent(content)}`;
  const pending = inflight.get(flightKey);
  if (pending) return pending;

  const work = attributeDialogueWithLlm(content, cast, orSettings)
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

/** Segment overrides for TTS (non-narrator only). */
export function buildSegmentOverrides(
  rawContent: string,
  cast: CharacterRow[],
  llmMap: LlmAttributionMap | null | undefined,
): Record<string, string> {
  const attribution = buildDialogueAttributionMap(
    rawContent,
    cast,
    llmMap ?? undefined,
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
): Promise<Record<string, string>> {
  const llm = await ensureDialogueAttribution(turnId, rawContent, cast);
  return buildSegmentOverrides(rawContent, cast, llm);
}

/** Warm cache for upcoming playback (fire-and-forget). */
export function prefetchDialogueAttributionBatch(
  turns: Array<{ id: string; content: string; role: string }>,
  cast: CharacterRow[],
): void {
  const settings = loadOpenRouterSettings();
  if (!isLlmReady() && !settings?.apiKey?.trim()) return;
  for (const t of turns) {
    if (t.role !== "assistant" || t.id.startsWith("tmp-")) continue;
    void ensureDialogueAttribution(t.id, t.content, cast, settings);
  }
}
