import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  defaultElevenUsdPer1k,
  ELEVEN_API_USD_PER_1K_FLASH,
  ELEVEN_API_USD_PER_1K_STANDARD,
  elevenTtsPriceTier,
} from "@/lib/server/elevenLabsApiPricing";

export type BillingSettings = {
  usdToEurRate: number;
  /** @deprecated Legacy flat ¢/1k — prefer USD fields + model tier */
  ttsCentsPer1kChars: number;
  ttsUsdPer1kFlash: number;
  ttsUsdPer1kStandard: number;
  updatedAt: string | null;
  source: "db" | "env";
};

const CACHE_TTL_MS = 30_000;

let cache: { settings: BillingSettings; at: number } | null = null;

function envUsdToEurRate(): number {
  const raw = process.env.BETA_USD_TO_EUR_RATE?.trim();
  const n = raw ? Number.parseFloat(raw) : 0.92;
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : 0.92;
}

function envTtsUsdFlash(): number {
  const raw = process.env.BETA_TTS_USD_PER_1K_FLASH?.trim();
  const n = raw ? Number.parseFloat(raw) : ELEVEN_API_USD_PER_1K_FLASH;
  return Number.isFinite(n) && n >= 0 ? n : ELEVEN_API_USD_PER_1K_FLASH;
}

function envTtsUsdStandard(): number {
  const raw = process.env.BETA_TTS_USD_PER_1K_STANDARD?.trim();
  const n = raw ? Number.parseFloat(raw) : ELEVEN_API_USD_PER_1K_STANDARD;
  return Number.isFinite(n) && n >= 0 ? n : ELEVEN_API_USD_PER_1K_STANDARD;
}

/** Legacy env flat rate (¢/1k EUR) — only if 013 columns missing */
function envTtsCentsPer1k(): number {
  const raw = process.env.BETA_TTS_CENTS_PER_1K_CHARS?.trim();
  const n = raw ? Number.parseFloat(raw) : 0;
  if (Number.isFinite(n) && n > 0) return n;
  return Math.ceil(
    ELEVEN_API_USD_PER_1K_STANDARD * envUsdToEurRate() * 100,
  );
}

export function billingSettingsFromEnv(): BillingSettings {
  const usdToEurRate = envUsdToEurRate();
  const ttsUsdPer1kFlash = envTtsUsdFlash();
  const ttsUsdPer1kStandard = envTtsUsdStandard();
  return {
    usdToEurRate,
    ttsUsdPer1kFlash,
    ttsUsdPer1kStandard,
    ttsCentsPer1kChars: envTtsCentsPer1k(),
    updatedAt: null,
    source: "env",
  };
}

export function invalidateBillingSettingsCache(): void {
  cache = null;
}

function parseRow(row: Record<string, unknown>): BillingSettings | null {
  const usd = Number(row.usd_to_eur_rate);
  if (!Number.isFinite(usd) || usd <= 0 || usd > 5) return null;

  const flashRaw = row.tts_usd_per_1k_flash;
  const standardRaw = row.tts_usd_per_1k_standard;
  const hasUsdCols =
    flashRaw !== undefined &&
    standardRaw !== undefined &&
    Number.isFinite(Number(flashRaw)) &&
    Number.isFinite(Number(standardRaw));

  const ttsUsdPer1kFlash = hasUsdCols
    ? Number(flashRaw)
    : ELEVEN_API_USD_PER_1K_FLASH;
  const ttsUsdPer1kStandard = hasUsdCols
    ? Number(standardRaw)
    : ELEVEN_API_USD_PER_1K_STANDARD;

  const legacyTts = Number(row.tts_cents_per_1k_chars);
  const ttsCentsPer1kChars =
    Number.isFinite(legacyTts) && legacyTts >= 0
      ? legacyTts
      : Math.ceil(ttsUsdPer1kStandard * usd * 100);

  return {
    usdToEurRate: usd,
    ttsUsdPer1kFlash,
    ttsUsdPer1kStandard,
    ttsCentsPer1kChars,
    updatedAt:
      typeof row.updated_at === "string" ? row.updated_at : null,
    source: "db",
  };
}

export async function fetchBillingSettings(
  supabase?: SupabaseClient | null,
): Promise<BillingSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.settings;
  }

  const client = supabase ?? createAdminSupabase();
  if (!client) {
    const settings = billingSettingsFromEnv();
    cache = { settings, at: Date.now() };
    return settings;
  }

  const { data, error } = await client
    .from("beta_billing_settings")
    .select(
      "usd_to_eur_rate, tts_cents_per_1k_chars, tts_usd_per_1k_flash, tts_usd_per_1k_standard, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    const settings = billingSettingsFromEnv();
    cache = { settings, at: Date.now() };
    return settings;
  }

  const parsed = parseRow(data as Record<string, unknown>);
  const settings = parsed ?? billingSettingsFromEnv();
  cache = { settings, at: Date.now() };
  return settings;
}

export function openRouterUsdToEurCents(
  usd: number,
  usdToEurRate: number,
  options?: { minCents?: number },
): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  const min = options?.minCents ?? 1;
  const cents = Math.ceil(usd * usdToEurRate * 100);
  if (min <= 0) return cents > 0 ? cents : 0;
  return Math.max(min, cents);
}

function falTtsBillableUnits(chars: number, modelId?: string): number {
  const model = modelId?.trim() ?? "";
  if (model.includes("kokoro")) {
    return Math.max(1, Math.ceil(chars / 1000));
  }
  return chars / 1000;
}

export function elevenUsdPer1kForModel(
  modelId: string | undefined,
  billing: BillingSettings,
): number {
  const tier = elevenTtsPriceTier(modelId);
  if (tier === "flash") return billing.ttsUsdPer1kFlash;
  return billing.ttsUsdPer1kStandard;
}

/** TTS log cost: Eleven API $/1k × USD→EUR (model-aware). */
export async function estimateTtsCostCents(
  supabase: SupabaseClient,
  characters: number,
  modelId?: string,
): Promise<number> {
  const billing = await fetchBillingSettings(supabase);
  return estimateTtsCostCentsFromBilling(billing, characters, modelId);
}

export function estimateTtsCostCentsFromBilling(
  billing: BillingSettings,
  characters: number,
  modelId?: string,
): number {
  const chars = Math.max(0, characters);
  if (!chars) return 0;

  const usdPer1k =
    billing.ttsUsdPer1kFlash > 0 || billing.ttsUsdPer1kStandard > 0
      ? elevenUsdPer1kForModel(modelId, billing)
      : billing.ttsCentsPer1kChars / (billing.usdToEurRate * 100);

  const eurCents = openRouterUsdToEurCents(
    (chars / 1000) * usdPer1k,
    billing.usdToEurRate,
  );
  return eurCents > 0 ? eurCents : 0;
}

function envOpenRouterTtsUsdPer1k(): number {
  const raw = process.env.BETA_OPENROUTER_TTS_USD_PER_1K?.trim();
  const n = raw ? Number.parseFloat(raw) : 1;
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

function envFishTtsUsdPer1mBytes(): number {
  const raw = process.env.BETA_FISH_TTS_USD_PER_1M_BYTES?.trim();
  const n = raw ? Number.parseFloat(raw) : 15;
  return Number.isFinite(n) && n >= 0 ? n : 15;
}

function envFalTtsUsdPer1k(modelId?: string): number {
  const model = modelId?.trim() ?? "";
  if (model.includes("inworld")) {
    const raw = process.env.BETA_FAL_INWORLD_TTS_USD_PER_1K?.trim();
    const n = raw ? Number.parseFloat(raw) : 0.01;
    return Number.isFinite(n) && n >= 0 ? n : 0.01;
  }
  if (model.includes("elevenlabs")) {
    const raw = process.env.BETA_FAL_ELEVEN_TTS_USD_PER_1K?.trim();
    const n = raw ? Number.parseFloat(raw) : 0.1;
    return Number.isFinite(n) && n >= 0 ? n : 0.1;
  }
  if (model.includes("minimax")) {
    const raw = process.env.BETA_FAL_MINIMAX_TTS_USD_PER_1K?.trim();
    const n = raw ? Number.parseFloat(raw) : 0.1;
    return Number.isFinite(n) && n >= 0 ? n : 0.1;
  }
  if (model.includes("qwen-3-tts")) {
    if (model.includes("0.6b")) {
      const raw = process.env.BETA_FAL_QWEN_TTS_06B_USD_PER_1K?.trim();
      const n = raw ? Number.parseFloat(raw) : 0.07;
      return Number.isFinite(n) && n >= 0 ? n : 0.07;
    }
    const raw = process.env.BETA_FAL_QWEN_TTS_17B_USD_PER_1K?.trim();
    const n = raw ? Number.parseFloat(raw) : 0.09;
    return Number.isFinite(n) && n >= 0 ? n : 0.09;
  }
  const raw = process.env.BETA_FAL_TTS_USD_PER_1K?.trim();
  const n = raw ? Number.parseFloat(raw) : 0.02;
  return Number.isFinite(n) && n >= 0 ? n : 0.02;
}

/** OpenRouter speech — flat $/1k chars (override via BETA_OPENROUTER_TTS_USD_PER_1K). */
export async function estimateOpenRouterTtsCostCents(
  supabase: SupabaseClient,
  characters: number,
): Promise<number> {
  const billing = await fetchBillingSettings(supabase);
  const chars = Math.max(0, characters);
  if (!chars) return 0;
  const eurCents = openRouterUsdToEurCents(
    (chars / 1000) * envOpenRouterTtsUsdPer1k(),
    billing.usdToEurRate,
  );
  return eurCents > 0 ? eurCents : 0;
}

/** Fish Audio — $/1M UTF-8 bytes (override via BETA_FISH_TTS_USD_PER_1M_BYTES). */
export async function estimateFishTtsCostCents(
  supabase: SupabaseClient,
  utf8Bytes: number,
): Promise<number> {
  const billing = await fetchBillingSettings(supabase);
  const bytes = Math.max(0, utf8Bytes);
  if (!bytes) return 0;
  const eurCents = openRouterUsdToEurCents(
    (bytes / 1_000_000) * envFishTtsUsdPer1mBytes(),
    billing.usdToEurRate,
  );
  return eurCents > 0 ? eurCents : 0;
}

/** fal.ai TTS — model-aware $/1k chars (Kokoro: pro 1000-Zeichen-Block). */
export async function estimateFalTtsCostCents(
  supabase: SupabaseClient,
  characters: number,
  modelId?: string,
): Promise<number> {
  const billing = await fetchBillingSettings(supabase);
  const chars = Math.max(0, characters);
  if (!chars) return 0;
  const usd =
    falTtsBillableUnits(chars, modelId) * envFalTtsUsdPer1k(modelId);
  const eurCents = openRouterUsdToEurCents(usd, billing.usdToEurRate, {
    minCents: 0,
  });
  return eurCents > 0 ? eurCents : 0;
}

export function formatEurCentsHint(
  usdPer1k: number,
  usdToEurRate: number,
): string {
  const eurCents = usdPer1k * usdToEurRate * 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(eurCents / 100);
}
