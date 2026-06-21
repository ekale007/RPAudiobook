import { brand } from "@/lib/brand";
import type { OpenRouterSettings } from "@/lib/types";

import { readCostCentsHeader, LLM_COST_HEADER } from "@/lib/llm/openRouterCompletion";
import { authFetch } from "@/lib/supabase/authFetch";
import { isLocalMode } from "@/lib/deploymentMode";
import { isServerLlmAvailable } from "@/lib/server/serverCapabilities";
import { resolveChatModelSettings } from "@/lib/storage/openRouterSettings";
import {
  extractOpenRouterErrorMessage,
  formatOpenRouterErrorMessage,
} from "@/lib/llm/openRouterErrors";



export interface StreamCallbacks {

  onToken: (text: string) => void;

  onDone: () => void;

  onError: (error: Error) => void;

}



async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      error?: string | { message?: string };
      retryAfterSec?: number | null;
      code?: string;
    };
    if (res.status === 429) {
      const errText =
        typeof j.error === "string" ? j.error : (j.error?.message ?? "");
      if (j.code === "insufficient_balance" || /guthaben/i.test(errText)) {
        return "Guthaben aufgebraucht — Konto → Guthaben aufladen (min. 5 €).";
      }
      if (j.code === "budget_exceeded" || /budget/i.test(errText)) {
        return "Budget erreicht — Konto → Guthaben aufladen.";
      }
      if (j.retryAfterSec) {
        const min = Math.max(1, Math.ceil(j.retryAfterSec / 60));
        return `Stündliches LLM-Limit — in ca. ${min} Min. wieder (Konto → Verbrauch).`;
      }
      return "LLM-Limit erreicht — Konto → Verbrauch.";
    }
    const raw =
      typeof j.error === "string"
        ? j.error
        : extractOpenRouterErrorMessage(j.error ?? j);
    return formatOpenRouterErrorMessage(raw, res.status);
  } catch {
    return res.statusText;
  }
}



export async function streamOpenRouterChat(
  settings: OpenRouterSettings,
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const chatSettings = resolveChatModelSettings(settings);

  if (isServerLlmAvailable() && !isLocalMode()) {
    await streamViaServer(chatSettings, messages, callbacks, signal);
    return;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": brand.openRouterAppTitle,
    },
    body: JSON.stringify({
      model: chatSettings.model,
      messages,
      max_tokens: chatSettings.maxTokens,
      temperature: chatSettings.temperature,
      stream: true,
    }),
    signal,
  });



  if (!res.ok) {

    callbacks.onError(new Error(`OpenRouter ${res.status}: ${await res.text()}`));

    return;

  }



  await consumeSseStream(res, callbacks, signal);

}



async function streamViaServer(

  settings: OpenRouterSettings,

  messages: Array<{ role: string; content: string }>,

  callbacks: StreamCallbacks,

  signal?: AbortSignal,

): Promise<void> {

  const res = await authFetch("/api/llm/chat", {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({

      messages,

      stream: true,

      maxTokens: settings.maxTokens,

      temperature: settings.temperature,

      model: settings.model,
    }),
    signal,
  });



  if (!res.ok) {

    callbacks.onError(

      new Error(`LLM ${res.status}: ${await parseErrorResponse(res)}`),

    );

    return;

  }



  await consumeSseStream(res, callbacks, signal);

}



async function consumeSseStream(

  res: Response,

  callbacks: StreamCallbacks,

  signal?: AbortSignal,

): Promise<void> {

  const reader = res.body?.getReader();

  if (!reader) {

    callbacks.onError(new Error("No response body"));

    return;

  }



  const decoder = new TextDecoder();

  let buffer = "";



  try {

    while (true) {

      if (signal?.aborted) break;

      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";



      for (const line of lines) {

        const trimmed = line.trim();

        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();

        if (data === "[DONE]") continue;

        try {

          const json = JSON.parse(data) as {

            choices?: Array<{ delta?: { content?: string } }>;

          };

          const delta = json.choices?.[0]?.delta?.content;

          if (delta) callbacks.onToken(delta);

        } catch {

          /* skip malformed chunks */

        }

      }

    }

    callbacks.onDone();

  } catch (e) {

    if ((e as Error).name === "AbortError") {

      callbacks.onDone();

      return;

    }

    callbacks.onError(e as Error);

  }

}



export type OpenRouterCompleteResult = {
  content: string;
  llmCostCents?: number;
};

type CompleteOpts = {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  responseFormat?:
    | { type: "json_object" }
    | {
        type: "json_schema";
        json_schema: {
          name: string;
          strict?: boolean;
          schema: Record<string, unknown>;
        };
      };
};

async function estimateLlmCostFromUsage(
  usage: unknown,
  modelId: string,
): Promise<number | undefined> {
  if (isLocalMode()) return undefined;
  if (!usage || typeof usage !== "object") return undefined;
  const u = usage as Record<string, unknown>;
  const promptTokens = Number(u.prompt_tokens ?? 0);
  const completionTokens = Number(u.completion_tokens ?? 0);
  const providerCostUsd =
    typeof u.cost === "number" && Number.isFinite(u.cost) ? u.cost : null;
  if (promptTokens <= 0 && completionTokens <= 0 && providerCostUsd == null) {
    return undefined;
  }
  try {
    const res = await authFetch("/api/usage/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "llm",
        promptTokens,
        completionTokens,
        modelId,
        providerCostUsd,
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { costCents?: number };
    return typeof json.costCents === "number" ? json.costCents : undefined;
  } catch {
    return undefined;
  }
}

export async function completeOpenRouterWithUsage(
  settings: OpenRouterSettings,
  messages: Array<{ role: string; content: string }>,
  opts?: CompleteOpts,
): Promise<OpenRouterCompleteResult> {
  if (isServerLlmAvailable() && !isLocalMode()) {
    const res = await authFetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        stream: false,
        maxTokens: opts?.maxTokens ?? 1024,
        temperature: opts?.temperature ?? 0.5,
        model: settings.model,
        responseFormat: opts?.responseFormat,
      }),
      signal: opts?.signal,
    });

    if (!res.ok) {
      throw new Error(`LLM ${res.status}: ${await parseErrorResponse(res)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      content: json.choices?.[0]?.message?.content?.trim() ?? "",
      llmCostCents: readCostCentsHeader(res, LLM_COST_HEADER),
    };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": brand.openRouterAppTitle,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.5,
      response_format: opts?.responseFormat,
    }),
    signal: opts?.signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    const message = formatOpenRouterErrorMessage(
      extractOpenRouterErrorMessage(errText),
      res.status,
    );
    throw new Error(`OpenRouter ${res.status}: ${message}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };
  const llmCostCents = await estimateLlmCostFromUsage(
    json.usage,
    settings.model,
  );
  return {
    content: json.choices?.[0]?.message?.content?.trim() ?? "",
    llmCostCents,
  };
}

export async function completeOpenRouter(
  settings: OpenRouterSettings,
  messages: Array<{ role: string; content: string }>,
  opts?: CompleteOpts,
): Promise<string> {
  return (await completeOpenRouterWithUsage(settings, messages, opts)).content;
}


