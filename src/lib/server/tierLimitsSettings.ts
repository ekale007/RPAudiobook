import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRateLimitLlmPerHour,
  getRateLimitTtsPerHour,
} from "@/lib/server/env";
import { getBetaLlmBudgetCents } from "@/lib/server/llmUsage";
import { getTtsStorageMaxPerUser } from "@/lib/server/ttsStorageQuota";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { invalidateBillingSettingsCache } from "@/lib/server/billingSettings";
import type { UserTier } from "@/lib/server/userTier";

export type TierLimitDefaults = {
  llmBudgetCents: number;
  llmPerHour: number;
  ttsPerHour: number;
  ttsStorageMax: number;
  /** null = full model catalog */
  allowedModelIds: string[] | null;
};

export type TierLimitsMap = Record<UserTier, TierLimitDefaults>;

const FREE_MODEL_IDS = [
  "google/gemini-2.5-flash-lite",
  "deepseek/deepseek-v4-flash",
  "qwen/qwen3.5-flash-02-23",
] as const;

const CACHE_TTL_MS = 30_000;
let cache: { map: TierLimitsMap; at: number } | null = null;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const n = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseFreeModelIdsFromEnv(): string[] {
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

export function tierLimitsFromEnv(): TierLimitsMap {
  return {
    free: {
      llmBudgetCents: envInt("BETA_TIER_FREE_LLM_BUDGET_CENTS", 500),
      llmPerHour: envInt("BETA_TIER_FREE_LLM_HOUR", 40),
      ttsPerHour: envInt("BETA_TIER_FREE_TTS_HOUR", 80),
      ttsStorageMax: envInt("BETA_TIER_FREE_TTS_STORAGE", 25),
      allowedModelIds: parseFreeModelIdsFromEnv(),
    },
    beta: {
      llmBudgetCents: getBetaLlmBudgetCents(),
      llmPerHour: getRateLimitLlmPerHour(),
      ttsPerHour: getRateLimitTtsPerHour(),
      ttsStorageMax: getTtsStorageMaxPerUser(),
      allowedModelIds: null,
    },
    pro: {
      llmBudgetCents: envInt("BETA_TIER_PRO_LLM_BUDGET_CENTS", 20_000),
      llmPerHour: envInt("BETA_TIER_PRO_LLM_HOUR", 500),
      ttsPerHour: envInt("BETA_TIER_PRO_TTS_HOUR", 400),
      ttsStorageMax: envInt("BETA_TIER_PRO_TTS_STORAGE", 200),
      allowedModelIds: null,
    },
  };
}

function parseLimitSlice(raw: unknown): Partial<TierLimitDefaults> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<TierLimitDefaults> = {};

  const intField = (
    key: keyof TierLimitDefaults,
    min: number,
    max: number,
  ) => {
    if (o[key] === undefined || o[key] === null) return;
    const n = Number(o[key]);
    if (Number.isFinite(n) && n >= min && n <= max) {
      (out as Record<string, number>)[key] = Math.floor(n);
    }
  };

  intField("llmBudgetCents", 1, 1_000_000);
  intField("llmPerHour", 1, 10_000);
  intField("ttsPerHour", 1, 10_000);
  intField("ttsStorageMax", 1, 10_000);

  if (o.allowedModelIds === null) {
    out.allowedModelIds = null;
  } else if (Array.isArray(o.allowedModelIds)) {
    const ids = o.allowedModelIds
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
    out.allowedModelIds = ids.length ? ids : null;
  }

  return Object.keys(out).length ? out : null;
}

export function parseTierLimitsJson(raw: unknown): Partial<TierLimitsMap> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<TierLimitsMap> = {};
  for (const tier of ["free", "beta", "pro"] as const) {
    const slice = parseLimitSlice(o[tier]);
    if (slice) out[tier] = slice as TierLimitDefaults;
  }
  return Object.keys(out).length ? out : null;
}

function mergeTierMap(
  envDefaults: TierLimitsMap,
  dbPartial: Partial<TierLimitsMap> | null,
): TierLimitsMap {
  const tiers = ["free", "beta", "pro"] as const;
  const result = {} as TierLimitsMap;
  for (const tier of tiers) {
    const base = envDefaults[tier];
    const over = dbPartial?.[tier];
    result[tier] = {
      llmBudgetCents: over?.llmBudgetCents ?? base.llmBudgetCents,
      llmPerHour: over?.llmPerHour ?? base.llmPerHour,
      ttsPerHour: over?.ttsPerHour ?? base.ttsPerHour,
      ttsStorageMax: over?.ttsStorageMax ?? base.ttsStorageMax,
      allowedModelIds:
        over?.allowedModelIds !== undefined
          ? over.allowedModelIds
          : base.allowedModelIds,
    };
  }
  return result;
}

export function invalidateTierLimitsCache(): void {
  cache = null;
  invalidateBillingSettingsCache();
}

export async function fetchTierLimitsMap(
  supabase?: SupabaseClient | null,
): Promise<TierLimitsMap> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.map;
  }

  const envDefaults = tierLimitsFromEnv();
  const client = supabase ?? createAdminSupabase();
  if (!client) {
    cache = { map: envDefaults, at: Date.now() };
    return envDefaults;
  }

  const { data, error } = await client
    .from("beta_billing_settings")
    .select("tier_limits")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data?.tier_limits) {
    cache = { map: envDefaults, at: Date.now() };
    return envDefaults;
  }

  const parsed = parseTierLimitsJson(data.tier_limits);
  const map = mergeTierMap(envDefaults, parsed);
  cache = { map, at: Date.now() };
  return map;
}

export function validateTierLimitsPayload(
  input: Partial<TierLimitsMap>,
): { ok: true; value: TierLimitsMap } | { ok: false; error: string } {
  const envDefaults = tierLimitsFromEnv();
  const merged = mergeTierMap(envDefaults, input);
  for (const tier of ["free", "beta", "pro"] as const) {
    const t = merged[tier];
    if (t.llmBudgetCents < 1) {
      return { ok: false, error: `${tier}: llmBudgetCents ungültig` };
    }
    if (t.llmPerHour < 1 || t.ttsPerHour < 1 || t.ttsStorageMax < 1) {
      return { ok: false, error: `${tier}: Stunden-/Storage-Limits ungültig` };
    }
  }
  return { ok: true, value: merged };
}
