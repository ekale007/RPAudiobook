import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLlmModelById,
  resolveAllowedLlmModel,
} from "@/lib/server/llmModels";

export type LlmUsageSnapshot = {
  periodMonth: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  budgetCents: number;
  budgetRemainingCents: number;
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

export function parseOpenRouterUsage(raw: unknown): {
  promptTokens: number;
  completionTokens: number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  const promptTokens = u.prompt_tokens ?? 0;
  const completionTokens = u.completion_tokens ?? 0;
  if (promptTokens <= 0 && completionTokens <= 0) return null;
  return { promptTokens, completionTokens };
}

export async function fetchMonthlyUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<LlmUsageSnapshot> {
  const periodMonth = currentUsageMonthUtc();
  const budgetCents = getBetaLlmBudgetCents();

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
  };
}

export async function recordLlmUsage(
  supabase: SupabaseClient,
  promptTokens: number,
  completionTokens: number,
  modelId?: string,
): Promise<void> {
  const costCents = estimateLlmCostCents(
    promptTokens,
    completionTokens,
    modelId,
  );
  const { error } = await supabase.rpc("increment_llm_usage", {
    p_prompt_tokens: promptTokens,
    p_completion_tokens: completionTokens,
    p_cost_cents: costCents,
  });
  if (error) throw error;
}

export function formatCentsDe(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
