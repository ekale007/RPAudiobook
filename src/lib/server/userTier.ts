import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRateLimitLlmPerHour,
  getRateLimitTtsPerHour,
} from "@/lib/server/env";
import { getBetaLlmBudgetCents } from "@/lib/server/llmUsage";
import { getTtsStorageMaxPerUser } from "@/lib/server/ttsStorageQuota";
import { getLlmModelCatalog, type LlmModelOption } from "@/lib/server/llmModels";

export type UserTier = "free" | "beta" | "pro";

export type UserProfileRow = {
  user_id: string;
  tier: UserTier;
  display_name: string | null;
  llm_budget_cents_override: number | null;
  llm_hourly_limit_override: number | null;
  tts_hourly_limit_override: number | null;
  tts_storage_max_override: number | null;
};

export type TierLimits = {
  tier: UserTier;
  tierLabel: string;
  llmBudgetCents: number;
  llmPerHour: number;
  ttsPerHour: number;
  ttsStorageMax: number;
  /** null = full catalog from BETA_LLM_MODELS */
  allowedModelIds: string[] | null;
};

const FREE_MODEL_IDS = [
  "google/gemini-2.5-flash-lite",
  "deepseek/deepseek-v4-flash",
  "qwen/qwen3.5-flash-02-23",
] as const;

const TIER_LABELS: Record<UserTier, string> = {
  free: "Free",
  beta: "Beta",
  pro: "Pro",
};

function parseTier(raw: unknown): UserTier {
  if (raw === "beta" || raw === "pro" || raw === "free") return raw;
  return "free";
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const n = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseFreeModelIds(): string[] {
  const raw = process.env.BETA_TIER_FREE_MODELS?.trim();
  if (!raw) return [...FREE_MODEL_IDS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...FREE_MODEL_IDS];
    const ids = parsed.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    return ids.length ? ids : [...FREE_MODEL_IDS];
  } catch {
    return [...FREE_MODEL_IDS];
  }
}

function baseLimitsForTier(tier: UserTier): Omit<TierLimits, "tier" | "tierLabel"> {
  switch (tier) {
    case "pro":
      return {
        llmBudgetCents: envInt("BETA_TIER_PRO_LLM_BUDGET_CENTS", 20_000),
        llmPerHour: envInt("BETA_TIER_PRO_LLM_HOUR", 500),
        ttsPerHour: envInt("BETA_TIER_PRO_TTS_HOUR", 400),
        ttsStorageMax: envInt("BETA_TIER_PRO_TTS_STORAGE", 200),
        allowedModelIds: null,
      };
    case "beta":
      return {
        llmBudgetCents: getBetaLlmBudgetCents(),
        llmPerHour: getRateLimitLlmPerHour(),
        ttsPerHour: getRateLimitTtsPerHour(),
        ttsStorageMax: getTtsStorageMaxPerUser(),
        allowedModelIds: null,
      };
    case "free":
    default:
      return {
        llmBudgetCents: envInt("BETA_TIER_FREE_LLM_BUDGET_CENTS", 500),
        llmPerHour: envInt("BETA_TIER_FREE_LLM_HOUR", 40),
        ttsPerHour: envInt("BETA_TIER_FREE_TTS_HOUR", 80),
        ttsStorageMax: envInt("BETA_TIER_FREE_TTS_STORAGE", 25),
        allowedModelIds: parseFreeModelIds(),
      };
  }
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfileRow> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "user_id, tier, display_name, llm_budget_cents_override, llm_hourly_limit_override, tts_hourly_limit_override, tts_storage_max_override",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    return {
      user_id: data.user_id as string,
      tier: parseTier(data.tier),
      display_name: (data.display_name as string | null) ?? null,
      llm_budget_cents_override:
        (data.llm_budget_cents_override as number | null) ?? null,
      llm_hourly_limit_override:
        (data.llm_hourly_limit_override as number | null) ?? null,
      tts_hourly_limit_override:
        (data.tts_hourly_limit_override as number | null) ?? null,
      tts_storage_max_override:
        (data.tts_storage_max_override as number | null) ?? null,
    };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("user_profiles")
    .insert({ user_id: userId, tier: "free" })
    .select(
      "user_id, tier, display_name, llm_budget_cents_override, llm_hourly_limit_override, tts_hourly_limit_override, tts_storage_max_override",
    )
    .single();

  if (insertErr) throw insertErr;
  return {
    user_id: inserted.user_id as string,
    tier: parseTier(inserted.tier),
    display_name: (inserted.display_name as string | null) ?? null,
    llm_budget_cents_override: null,
    llm_hourly_limit_override: null,
    tts_hourly_limit_override: null,
    tts_storage_max_override: null,
  };
}

export function resolveTierLimits(profile: UserProfileRow): TierLimits {
  const tier = profile.tier;
  const base = baseLimitsForTier(tier);
  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    llmBudgetCents:
      profile.llm_budget_cents_override ?? base.llmBudgetCents,
    llmPerHour: profile.llm_hourly_limit_override ?? base.llmPerHour,
    ttsPerHour: profile.tts_hourly_limit_override ?? base.ttsPerHour,
    ttsStorageMax: profile.tts_storage_max_override ?? base.ttsStorageMax,
    allowedModelIds: base.allowedModelIds,
  };
}

export async function fetchUserTierLimits(
  supabase: SupabaseClient,
  userId: string,
): Promise<TierLimits> {
  const profile = await ensureUserProfile(supabase, userId);
  return resolveTierLimits(profile);
}

export async function getTtsHourlyLimitForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  try {
    return (await fetchUserTierLimits(supabase, userId)).ttsPerHour;
  } catch {
    return getRateLimitTtsPerHour();
  }
}

export function filterCatalogForTier(
  catalog: LlmModelOption[],
  limits: TierLimits,
): LlmModelOption[] {
  if (!limits.allowedModelIds?.length) return catalog;
  const allowed = new Set(limits.allowedModelIds);
  const filtered = catalog.filter((m) => allowed.has(m.id));
  return filtered.length ? filtered : catalog.slice(0, 1);
}

export function resolveAllowedLlmModelForTier(
  requested: string | null | undefined,
  limits: TierLimits,
): LlmModelOption {
  const catalog = filterCatalogForTier(getLlmModelCatalog(), limits);
  const trimmed = requested?.trim();
  if (trimmed) {
    const match = catalog.find((m) => m.id === trimmed);
    if (match) return match;
  }
  const adminDefault = process.env.OPENROUTER_MODEL?.trim();
  if (adminDefault) {
    const match = catalog.find((m) => m.id === adminDefault);
    if (match) return match;
  }
  return catalog[0] ?? getLlmModelCatalog()[0];
}
