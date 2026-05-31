import type { OpenRouterSettings } from "@/lib/types";

import { authFetch } from "@/lib/supabase/authFetch";
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
      if (j.code === "budget_exceeded" || /budget/i.test(errText)) {
        return "Monatliches Beta-Budget erreicht — Settings → Beta LLM Verbrauch.";
      }
      if (j.retryAfterSec) {
        const min = Math.max(1, Math.ceil(j.retryAfterSec / 60));
        return `Stündliches LLM-Limit — in ca. ${min} Min. wieder (Settings → Verbrauch).`;
      }
      return "LLM-Limit erreicht — Settings → Beta LLM Verbrauch.";
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

  if (isServerLlmAvailable()) {

    await streamViaServer(settings, messages, callbacks, signal);

    return;

  }



  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {

    method: "POST",

    headers: {

      Authorization: `Bearer ${settings.apiKey}`,

      "Content-Type": "application/json",

      "HTTP-Referer":

        typeof window !== "undefined" ? window.location.origin : "",

      "X-Title": "HörbuchKI",

    },

    body: JSON.stringify({

      model: settings.model,

      messages,

      max_tokens: settings.maxTokens,

      temperature: settings.temperature,

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

      useNarratorModel: false,

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



export async function completeOpenRouter(

  settings: OpenRouterSettings,

  messages: Array<{ role: string; content: string }>,

  opts?: {

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

    useNarratorModel?: boolean;

  },

): Promise<string> {

  const resolved = resolveChatModelSettings(settings);

  if (isServerLlmAvailable()) {

    const res = await authFetch("/api/llm/chat", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        messages,

        stream: false,

        maxTokens: opts?.maxTokens ?? 1024,

        temperature: opts?.temperature ?? 0.5,

        model: resolved.model,

        useNarratorModel: opts?.useNarratorModel,

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

    return json.choices?.[0]?.message?.content?.trim() ?? "";

  }



  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {

    method: "POST",

    headers: {

      Authorization: `Bearer ${settings.apiKey}`,

      "Content-Type": "application/json",

      "HTTP-Referer":

        typeof window !== "undefined" ? window.location.origin : "",

      "X-Title": "HörbuchKI",

    },

    body: JSON.stringify({

      model: resolved.model,

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

  };

  return json.choices?.[0]?.message?.content?.trim() ?? "";

}


