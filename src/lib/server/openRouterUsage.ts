/** Parse OpenRouter `usage` object (always included in responses since 2024). */

export type OpenRouterUsageParsed = {
  promptTokens: number;
  completionTokens: number;
  /** USD charged to OpenRouter account (when present). */
  providerCostUsd: number | null;
  cachedTokens: number;
  generationId: string | null;
};

export function parseOpenRouterUsageFull(
  raw: unknown,
  generationId?: string | null,
): OpenRouterUsageParsed | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;

  const promptTokens = Number(u.prompt_tokens ?? 0);
  const completionTokens = Number(u.completion_tokens ?? 0);
  if (promptTokens <= 0 && completionTokens <= 0) return null;

  let providerCostUsd: number | null = null;
  if (typeof u.cost === "number" && Number.isFinite(u.cost)) {
    providerCostUsd = u.cost;
  }

  const cachedTokens =
    typeof u.prompt_tokens_details === "object" &&
    u.prompt_tokens_details !== null
      ? Number(
          (u.prompt_tokens_details as { cached_tokens?: number }).cached_tokens ??
            0,
        )
      : 0;

  return {
    promptTokens,
    completionTokens,
    providerCostUsd,
    cachedTokens,
    generationId: generationId?.trim() || null,
  };
}

export function parseGenerationIdFromChatJson(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const id = (json as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Optional: fetch exact cost from OpenRouter generation API. */
export async function fetchOpenRouterGeneration(
  apiKey: string,
  generationId: string,
): Promise<{
  totalCostUsd: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  model: string | null;
} | null> {
  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Record<string, unknown> };
    const d = json.data;
    if (!d) return null;
    return {
      totalCostUsd:
        typeof d.total_cost === "number" ? d.total_cost : null,
      promptTokens:
        typeof d.tokens_prompt === "number" ? d.tokens_prompt : null,
      completionTokens:
        typeof d.tokens_completion === "number" ? d.tokens_completion : null,
      model: typeof d.model === "string" ? d.model : null,
    };
  } catch {
    return null;
  }
}
