/**
 * Server-side OpenRouter completion helper.
 *
 * Why this file exists (Phase 8.6): the chapter-close endpoint
 * (`/api/chapter/close`) needs to drive LLM calls from a Vercel
 * serverless function. It can't call `/api/llm/chat` via `authFetch`
 * with a relative URL — Node's fetch on Vercel has no
 * `window.location.origin`, so it throws `ERR_INVALID_URL`.
 *
 * This helper bypasses the HTTP roundtrip and posts directly to
 * OpenRouter with the server-side API key. It mirrors the logic
 * `/api/llm/chat` already does:
 *
 *   - resolve the model against the user's tier (`resolveAllowedLlmModelForTier`)
 *   - on 404 + privacy error, fall back to the admin default model
 *   - record usage so the wallet is debited (`recordUsageFromJsonResponse`)
 *
 * The caller is still responsible for the **pre-LLM** checks —
 * `requireUser`, `requireSpendableBalance`, `checkRateLimit` — and for
 * telling the user about failures via the toast. That keeps wallet /
 * rate-limit policy out of this generic helper.
 *
 * Globals: Vercel-Serverless is a per-request lambda, so module
 * globals are isolated. The chapter-close endpoint sets the context
 * once via `setServerLlmContext({ supabase, tierLimits })` at the top
 * of the request, then every `completeOpenRouterWithUsage` call inside
 * that request picks it up. The browser bundle never imports this
 * file (it's a server-only module by path convention).
 */
import { brand } from "@/lib/brand";
import {
  extractOpenRouterErrorMessage,
  formatOpenRouterErrorMessage,
  isOpenRouterPrivacyError,
} from "@/lib/llm/openRouterErrors";
import { getOpenRouterApiKey, getOpenRouterModel } from "@/lib/server/env";
import { recordUsageFromJsonResponse } from "@/lib/server/llmUsageStream";
import {
  resolveAllowedLlmModelForTier,
  type TierLimits,
} from "@/lib/server/userTier";
import type { SupabaseClient } from "@supabase/supabase-js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type ServerLlmContext = {
  supabase: SupabaseClient;
  tierLimits: TierLimits;
};

/**
 * Per-request context set by the API route before any LLM work.
 * Lives on `globalThis` so the universal `lib/llm/openrouter.ts`
 * module can read it without us passing a supabase client through
 * every signature in the codebase.
 */
const GLOBAL_KEY = "__rpAudiobookServerLlmContext__";
type GlobalShape = { [GLOBAL_KEY]?: ServerLlmContext };

function getGlobal(): GlobalShape {
  return globalThis as unknown as GlobalShape;
}

export function setServerLlmContext(ctx: ServerLlmContext): void {
  getGlobal()[GLOBAL_KEY] = ctx;
}

export function clearServerLlmContext(): void {
  delete getGlobal()[GLOBAL_KEY];
}

export function getServerLlmContext(): ServerLlmContext | null {
  return getGlobal()[GLOBAL_KEY] ?? null;
}

function openRouterHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    "X-Title": brand.openRouterAppTitle,
  };
}

type ChatMessage = { role: string; content: string };

export type ServerCompleteOpts = {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: unknown;
};

export type ServerCompleteResult = {
  content: string;
  llmCostCents: number;
  modelId: string;
};

/**
 * Run a non-streaming OpenRouter chat completion on the server.
 *
 * Reads the per-request context set by `setServerLlmContext`. Throws
 * a user-friendly German Error if the context is missing (caller
 * forgot to set it) or if the OpenRouter request fails after the
 * privacy-error fallback. The chapter-close endpoint surfaces this
 * message verbatim in its toast.
 */
export async function serverCompleteOpenRouter(
  messages: ChatMessage[],
  opts: ServerCompleteOpts = {},
): Promise<ServerCompleteResult> {
  const ctx = getServerLlmContext();
  if (!ctx) {
    throw new Error(
      "Server-LLM-Kontext fehlt — setServerLlmContext() wurde nicht aufgerufen.",
    );
  }
  const { supabase, tierLimits } = ctx;

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY nicht auf Vercel gesetzt — LLM-Provider nicht verfügbar.",
    );
  }

  const resolved = resolveAllowedLlmModelForTier(undefined, tierLimits);
  const fallback = resolveAllowedLlmModelForTier(
    getOpenRouterModel(),
    tierLimits,
  );
  const modelId = resolved.id;
  const fallbackId = fallback.id;

  const basePayload: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.85,
  };
  if (opts.responseFormat) {
    basePayload.response_format = opts.responseFormat;
  }

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(basePayload),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    const message = extractOpenRouterErrorMessage(errText);
    const formatted = formatOpenRouterErrorMessage(message, upstream.status);

    if (
      upstream.status === 404 &&
      isOpenRouterPrivacyError(message) &&
      fallbackId !== modelId
    ) {
      const retry = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: openRouterHeaders(apiKey),
        body: JSON.stringify({ ...basePayload, model: fallbackId }),
      });
      if (retry.ok) {
        return finalizeSuccess(supabase, retry, fallbackId);
      }
    }

    throw new Error(`OpenRouter ${upstream.status}: ${formatted}`);
  }

  return finalizeSuccess(supabase, upstream, modelId);
}

async function finalizeSuccess(
  supabase: SupabaseClient,
  upstream: Response,
  modelId: string,
): Promise<ServerCompleteResult> {
  const json = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";
  let llmCostCents = 0;
  try {
    llmCostCents = await recordUsageFromJsonResponse(supabase, json, modelId);
  } catch (e) {
    // Usage tracking is best-effort. A failed wallet debit here would
    // not block the chapter-close flow — we still got our LLM answer.
    console.warn("serverCompleteOpenRouter: usage record failed", e);
  }
  return { content, llmCostCents, modelId };
}
