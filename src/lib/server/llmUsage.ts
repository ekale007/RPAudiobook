import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLlmModelById,
  resolveAllowedLlmModel,
} from "@/lib/server/llmModels";
import { parseOpenRouterUsageFull } from "@/lib/server/openRouterUsage";
import type { UserTier } from "@/lib/server/userTier";
import { fetchUserTierLimits } from "@/lib/server/userTier";
import {
  fetchBillingSettings,
  openRouterUsdToEurCents,
} from "@/lib/server/billingSettings";
import { insertUsageEvent } from "@/lib/server/usageEvents";

export type LlmUsageSnapshot = {
  periodMonth: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  budgetCents: number;
  budgetRemainingCents: number;
  tier?: UserTier;
  tierLabel?: string;
};

export function currentUsageMonthUtc(): string {
  return new Date().toISOString().slice(0, 7);
}
/** Default monthly LLM budget per user (100,00 €). Override via BETA_LLM_BUDGET_CENTS. */
const DEFAULT_BETA_LLM_BUDGET_CENTS = 10_000;

export function getBetaLlmBudgetCents(): number {
  const raw = process.env.BETA_LLM_BUDGET_CENTS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_BETA_LLM_BUDGET_CENTS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BETA_LLM_BUDGET_CENTS;
}

export function getLlmPromptCentsPer1k(): number {
  const raw = process.env.BETA_LLM_PROMPT_CENTS_PER_1K?.trim();
  const n = raw ? Number.parseFloat(raw) : 0.3;
  return Number.isFinite(n) && n >= 0 ? n : 0.3;
}

export function getLlmCompletionCentsPer1k(): number {
  const raw = process.env.BETA_LLM_COMPLETION_CENTS_PER_1K?.trim();
  const n = raw ? Number.parseFloat(raw) : 1.5;
  return Number.isFinite(n) && n >= 0 ? n : 1.5;
}

/** Fallback when OpenRouter omits usage (stream edge cases). */
export function fallbackUsageEstimate(modelId?: string): {
  promptTokens: number;
  completionTokens: number;
  costCents: number;
} {
  const promptTokens = 2500;
  const completionTokens = 900;
  return {
    promptTokens,
    completionTokens,
    costCents: estimateLlmCostCents(promptTokens, completionTokens, modelId),
  };
}

export function estimateLlmCostCents(
  promptTokens: number,
  completionTokens: number,
  modelId?: string,
): number {
  const prompt = Math.max(0, promptTokens);
  const completion = Math.max(0, completionTokens);
  const pricing =
    getLlmModelById(modelId) ?? resolveAllowedLlmModel(modelId);
  const cost =
    (prompt / 1000) * pricing.promptCentsPer1k +
    (completion / 1000) * pricing.completionCentsPer1k;
  return Math.max(1, Math.ceil(cost));
}

export type LlmChargeSource = "openrouter" | "catalog";

/** Monatsbudget & Log: OpenRouter-`usage.cost` (USD), sonst Katalog aus BETA_LLM_MODELS. */
export async function resolveLlmChargeCents(
  supabase: SupabaseClient,
  promptTokens: number,
  completionTokens: number,
  modelId: string | undefined,
  providerCostUsd: number | null | undefined,
): Promise<{ costCents: number; source: LlmChargeSource }> {
  const billing = await fetchBillingSettings(supabase);
  if (
    providerCostUsd != null &&
    Number.isFinite(providerCostUsd) &&
    providerCostUsd > 0
  ) {
    return {
      costCents: openRouterUsdToEurCents(
        providerCostUsd,
        billing.usdToEurRate,
      ),
      source: "openrouter",
    };
  }
  return {
    costCents: estimateLlmCostCents(promptTokens, completionTokens, modelId),
    source: "catalog",
  };
}

export function parseOpenRouterUsage(raw: unknown): {
  promptTokens: number;
  completionTokens: number;
} | null {
  const full = parseOpenRouterUsageFull(raw);
  if (!full) return null;
  return {
    promptTokens: full.promptTokens,
    completionTokens: full.completionTokens,
  };
}

export async function fetchMonthlyUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<LlmUsageSnapshot> {
  const periodMonth = currentUsageMonthUtc();
  const tierLimits = await fetchUserTierLimits(supabase, userId);
  const budgetCents = tierLimits.llmBudgetCents;

  const { data, error } = await supabase
    .from("user_llm_usage")
    .select("request_count, prompt_tokens, completion_tokens, cost_cents")
    .eq("user_id", userId)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (error) throw error;

  const costCents = (data?.cost_cents as number | undefined) ?? 0;
  return {
    periodMonth,
    requestCount: (data?.request_count as number | undefined) ?? 0,
    promptTokens: Number(data?.prompt_tokens ?? 0),
    completionTokens: Number(data?.completion_tokens ?? 0),
    costCents,
    budgetCents,
    budgetRemainingCents: Math.max(0, budgetCents - costCents),
    tier: tierLimits.tier,
    tierLabel: tierLimits.tierLabel,
  };
}

export type RecordLlmUsageOptions = {
  label?: string;
  providerRef?: string | null;
  providerCostUsd?: number | null;
  durationMs?: number;
  storyId?: string | null;
  status?: "ok" | "error";
};

export async function recordLlmUsage(
  supabase: SupabaseClient,
  promptTokens: number,
  completionTokens: number,
  modelId?: string,
  options?: RecordLlmUsageOptions,
): Promise<number> {
  const { costCents } = await resolveLlmChargeCents(
    supabase,
    promptTokens,
    completionTokens,
    modelId,
    options?.providerCostUsd,
  );
  const { error } = await supabase.rpc("increment_llm_usage", {
    p_prompt_tokens: promptTokens,
    p_completion_tokens: completionTokens,
    p_cost_cents: costCents,
  });
  if (error) throw error;

  await insertUsageEvent(supabase, {
    kind: "llm",
    status: options?.status ?? "ok",
    label: options?.label ?? "LLM Chat",
    modelId,
    providerRef: options?.providerRef,
    promptTokens,
    completionTokens,
    costCents,
    providerCostUsd: options?.providerCostUsd ?? null,
    durationMs: options?.durationMs,
    storyId: options?.storyId,
  });
  return costCents;
}

export function formatCentsDe(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
