import type { SupabaseClient } from "@supabase/supabase-js";
import { getRateLimitTtsPerHour } from "@/lib/server/env";
import { getLlmModelCatalog, type LlmModelOption } from "@/lib/server/llmModels";
import { fetchTierLimitsMap } from "@/lib/server/tierLimitsSettings";

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

const TIER_LABELS: Record<UserTier, string> = {
  free: "Free",
  beta: "Beta",
  pro: "Pro",
};

function parseTier(raw: unknown): UserTier {
  if (raw === "beta" || raw === "pro" || raw === "free") return raw;
  return "free";
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

export function resolveTierLimits(
  profile: UserProfileRow,
  tierDefaults: Awaited<ReturnType<typeof fetchTierLimitsMap>>,
): TierLimits {
  const tier = profile.tier;
  const base = tierDefaults[tier];
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
  const [profile, tierDefaults] = await Promise.all([
    ensureUserProfile(supabase, userId),
    fetchTierLimitsMap(supabase),
  ]);
  return resolveTierLimits(profile, tierDefaults);
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
