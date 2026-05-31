import {
  estimateLlmCostCents,
  fallbackUsageEstimate,
  parseOpenRouterUsage,
  recordLlmUsage,
} from "@/lib/server/llmUsage";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Forward SSE stream to client and record token usage when OpenRouter sends it. */
export function createUsageTrackingStream(
  upstream: ReadableStream<Uint8Array>,
  supabase: SupabaseClient,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let recorded = false;
  let lastUsage: { promptTokens: number; completionTokens: number } | null =
    null;

  const persist = async () => {
    if (recorded) return;
    recorded = true;
    const usage = lastUsage ?? fallbackUsageEstimate();
    try {
      await recordLlmUsage(
        supabase,
        usage.promptTokens,
        usage.completionTokens,
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
              const json = JSON.parse(data) as { usage?: unknown };
              const parsed = parseOpenRouterUsage(json.usage);
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
): Promise<void> {
  const root = json as { usage?: unknown };
  const parsed = parseOpenRouterUsage(root.usage);
  if (parsed) {
    await recordLlmUsage(
      supabase,
      parsed.promptTokens,
      parsed.completionTokens,
    );
    return;
  }
  const fallback = fallbackUsageEstimate();
  await recordLlmUsage(
    supabase,
    fallback.promptTokens,
    fallback.completionTokens,
  );
}
