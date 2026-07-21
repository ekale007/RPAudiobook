/**
 * Multi-provider LLM routing layer.
 *
 * OpenRouter is the default. Google AI Studio and Groq are added as
 * alternative providers that the chat route dispatches to based on the
 * resolved model's `provider` field. Each provider gets its own env var
 * for the API key, so all can be active simultaneously.
 */
import { brand } from "@/lib/brand";

export type LlmProvider = "openrouter" | "google-ai-studio" | "groq";

export type LlmModelOptionWithProvider = {
  id: string;
  label: string;
  promptCentsPer1k: number;
  completionCentsPer1k: number;
  /** Which API to call. Defaults to "openrouter". */
  provider?: LlmProvider;
  /** Model ID to send to the provider (defaults to `id`). */
  providerModelId?: string;
};

export interface ProviderConfig {
  name: LlmProvider;
  /** Base URL for chat completions (OpenAI-compatible) */
  url: string;
  /** Returns HTTP headers for the provider's API call */
  headers: () => Record<string, string>;
  /** Whether this provider is configured (API key present) */
  isConfigured: () => boolean;
}

function getApiKey(envName: string): string | null {
  return process.env[envName]?.trim() || null;
}

export function getProviderConfig(name: LlmProvider): ProviderConfig | null {
  switch (name) {
    case "openrouter": {
      const key = getApiKey("OPENROUTER_API_KEY");
      if (!key) return null;
      return {
        name: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: () => ({
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          "X-Title": brand.openRouterAppTitle,
        }),
        isConfigured: () => Boolean(key),
      };
    }
    case "google-ai-studio": {
      const key = getApiKey("GEMINI_API_KEY");
      if (!key) return null;
      return {
        name: "google-ai-studio",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: () => ({
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        }),
        isConfigured: () => Boolean(key),
      };
    }
    case "groq": {
      const key = getApiKey("GROQ_API_KEY");
      if (!key) return null;
      return {
        name: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: () => ({
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        }),
        isConfigured: () => Boolean(key),
      };
    }
    default:
      return null;
  }
}

/** Dispatch an OpenAI-compatible chat completion to the right provider. */
export async function postLlmCompletion(
  provider: LlmProvider,
  payload: Record<string, unknown>,
): Promise<Response> {
  const config = getProviderConfig(provider);
  if (!config) {
    throw new Error(
      `LLM provider "${provider}" nicht konfiguriert — API-Key fehlt.`,
    );
  }
  return fetch(config.url, {
    method: "POST",
    headers: config.headers(),
    body: JSON.stringify(payload),
  });
}
