import { fallbackUsageEstimate, recordLlmUsage } from "@/lib/server/llmUsage";
import {
  fetchOpenRouterGeneration,
  parseGenerationIdFromChatJson,
  parseOpenRouterUsageFull,
} from "@/lib/server/openRouterUsage";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Forward SSE stream to client and record token usage when OpenRouter sends it. */
export function createUsageTrackingStream(
  upstream: ReadableStream<Uint8Array>,
  supabase: SupabaseClient,
  modelId: string,
  openRouterApiKey?: string | null,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let recorded = false;
  let lastUsage: ReturnType<typeof parseOpenRouterUsageFull> = null;
  let generationId: string | null = null;

  const persist = async () => {
    if (recorded) return;
    recorded = true;
    let usage =
      lastUsage ??
      (() => {
        const fb = fallbackUsageEstimate(modelId);
        return {
          promptTokens: fb.promptTokens,
          completionTokens: fb.completionTokens,
          providerCostUsd: null,
          cachedTokens: 0,
          generationId,
        };
      })();

    const genId = usage.generationId ?? generationId;
    if (
      (usage.providerCostUsd == null || usage.providerCostUsd <= 0) &&
      genId &&
      openRouterApiKey?.trim()
    ) {
      const gen = await fetchOpenRouterGeneration(openRouterApiKey.trim(), genId);
      if (gen?.totalCostUsd != null && gen.totalCostUsd > 0) {
        usage = { ...usage, providerCostUsd: gen.totalCostUsd };
        if (gen.promptTokens != null) usage.promptTokens = gen.promptTokens;
        if (gen.completionTokens != null) {
          usage.completionTokens = gen.completionTokens;
        }
      }
    }

    try {
      await recordLlmUsage(
        supabase,
        usage.promptTokens,
        usage.completionTokens,
        modelId,
        {
          label: "LLM Chat (Stream)",
          providerRef: usage.generationId ?? generationId,
          providerCostUsd: usage.providerCostUsd,
        },
      );
    } catch (e) {
      console.warn("LLM usage record failed:", e);
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          await persist();
          controller.close();
          return;
        }
        if (value) {
          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as Record<string, unknown>;
              const id = parseGenerationIdFromChatJson(json);
              if (id) generationId = id;
              const parsed = parseOpenRouterUsageFull(json.usage, id ?? generationId);
              if (parsed) lastUsage = parsed;
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        await persist();
        controller.error(e);
      }
    },
    async cancel() {
      await persist();
      await reader.cancel();
    },
  });
}

export async function recordUsageFromJsonResponse(
  supabase: SupabaseClient,
  json: unknown,
  modelId: string,
): Promise<void> {
  const generationId = parseGenerationIdFromChatJson(json);
  const root = json as { usage?: unknown };
  const parsed = parseOpenRouterUsageFull(root.usage, generationId);
  if (parsed) {
    await recordLlmUsage(
      supabase,
      parsed.promptTokens,
      parsed.completionTokens,
      modelId,
      {
        label: "LLM Chat",
        providerRef: parsed.generationId ?? generationId,
        providerCostUsd: parsed.providerCostUsd,
      },
    );
    return;
  }
  const fallback = fallbackUsageEstimate(modelId);
  await recordLlmUsage(
    supabase,
    fallback.promptTokens,
    fallback.completionTokens,
    modelId,
    {
      label: "LLM Chat (geschätzt)",
      providerRef: generationId,
    },
  );
}
