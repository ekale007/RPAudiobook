import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  ELEVEN_API_USD_PER_1K_FLASH,
  ELEVEN_API_USD_PER_1K_STANDARD,
} from "@/lib/server/elevenLabsApiPricing";
import {
  getLlmModelCatalog,
  type LlmModelOption,
} from "@/lib/server/llmModels";
import { invalidateBillingSettingsCache } from "@/lib/server/billingSettings";

export type LlmPricingEntry = {
  id: string;
  label: string;
  promptCentsPer1k: number;
  completionCentsPer1k: number;
  markupPercent: number;
};

export type TtsPricingUnit = "per_1k_chars" | "per_1m_bytes" | "per_1k_blocks";

export type TtsPricingEntry = {
  key: string;
  label: string;
  unit: TtsPricingUnit;
  usdCost: number;
  markupPercent: number;
};

export type ProviderPricingPayload = {
  llm: LlmPricingEntry[];
  tts: TtsPricingEntry[];
};

const TTS_DEFINITIONS: Array<
  Omit<TtsPricingEntry, "usdCost" | "markupPercent">
> = [
  {
    key: "elevenlabs:flash",
    label: "ElevenLabs Flash / Turbo",
    unit: "per_1k_chars",
  },
  {
    key: "elevenlabs:standard",
    label: "ElevenLabs Multilingual v2/v3",
    unit: "per_1k_chars",
  },
  { key: "fish", label: "Fish Audio S2", unit: "per_1m_bytes" },
  { key: "openrouter", label: "OpenRouter TTS", unit: "per_1k_chars" },
  { key: "fal:default", label: "fal.ai TTS (Standard)", unit: "per_1k_chars" },
  { key: "fal:kokoro", label: "fal.ai Kokoro", unit: "per_1k_blocks" },
  { key: "fal:inworld", label: "fal.ai Inworld", unit: "per_1k_chars" },
  {
    key: "fal:elevenlabs",
    label: "fal.ai ElevenLabs",
    unit: "per_1k_chars",
  },
  { key: "fal:minimax", label: "fal.ai MiniMax", unit: "per_1k_chars" },
  {
    key: "fal:qwen-06b",
    label: "fal.ai Qwen TTS 0.6B",
    unit: "per_1k_chars",
  },
  {
    key: "fal:qwen-17b",
    label: "fal.ai Qwen TTS 1.7B",
    unit: "per_1k_chars",
  },
];

function envUsd(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const n = raw ? Number.parseFloat(raw) : fallback;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function defaultTtsUsdCost(key: string): number {
  switch (key) {
    case "elevenlabs:flash":
      return envUsd("BETA_TTS_USD_PER_1K_FLASH", ELEVEN_API_USD_PER_1K_FLASH);
    case "elevenlabs:standard":
      return envUsd(
        "BETA_TTS_USD_PER_1K_STANDARD",
        ELEVEN_API_USD_PER_1K_STANDARD,
      );
    case "fish":
      return envUsd("BETA_FISH_TTS_USD_PER_1M_BYTES", 15);
    case "openrouter":
      return envUsd("BETA_OPENROUTER_TTS_USD_PER_1K", 1);
    case "fal:kokoro":
      return envUsd("BETA_FAL_TTS_USD_PER_1K", 0.02);
    case "fal:inworld":
      return envUsd("BETA_FAL_INWORLD_TTS_USD_PER_1K", 0.01);
    case "fal:elevenlabs":
      return envUsd("BETA_FAL_ELEVEN_TTS_USD_PER_1K", 0.1);
    case "fal:minimax":
      return envUsd("BETA_FAL_MINIMAX_TTS_USD_PER_1K", 0.1);
    case "fal:qwen-06b":
      return envUsd("BETA_FAL_QWEN_TTS_06B_USD_PER_1K", 0.07);
    case "fal:qwen-17b":
      return envUsd("BETA_FAL_QWEN_TTS_17B_USD_PER_1K", 0.09);
    default:
      return envUsd("BETA_FAL_TTS_USD_PER_1K", 0.02);
  }
}

export function defaultProviderPricing(): ProviderPricingPayload {
  const llm = getLlmModelCatalog().map((m) => ({
    id: m.id,
    label: m.label,
    promptCentsPer1k: m.promptCentsPer1k,
    completionCentsPer1k: m.completionCentsPer1k,
    markupPercent: 0,
  }));
  const tts = TTS_DEFINITIONS.map((def) => ({
    ...def,
    usdCost: defaultTtsUsdCost(def.key),
    markupPercent: 0,
  }));
  return { llm, tts };
}

function parseMarkup(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 500) return 0;
  return Math.round(n * 100) / 100;
}

function parseLlmRow(
  raw: unknown,
  fallback?: LlmModelOption,
): LlmPricingEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : fallback?.id ?? "";
  if (!id) return null;
  const promptCentsPer1k = Number(
    o.promptCentsPer1k ?? fallback?.promptCentsPer1k,
  );
  const completionCentsPer1k = Number(
    o.completionCentsPer1k ?? fallback?.completionCentsPer1k,
  );
  if (
    !Number.isFinite(promptCentsPer1k) ||
    !Number.isFinite(completionCentsPer1k) ||
    promptCentsPer1k < 0 ||
    completionCentsPer1k < 0
  ) {
    return null;
  }
  const label =
    typeof o.label === "string" && o.label.trim()
      ? o.label.trim()
      : fallback?.label ?? id.split("/").pop() ?? id;
  return {
    id,
    label,
    promptCentsPer1k,
    completionCentsPer1k,
    markupPercent: parseMarkup(o.markupPercent),
  };
}

function parseTtsRow(
  raw: unknown,
  def: Omit<TtsPricingEntry, "usdCost" | "markupPercent">,
): TtsPricingEntry {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const usdCost = Number(o.usdCost ?? defaultTtsUsdCost(def.key));
  return {
    key: def.key,
    label:
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : def.label,
    unit: def.unit,
    usdCost:
      Number.isFinite(usdCost) && usdCost >= 0
        ? usdCost
        : defaultTtsUsdCost(def.key),
    markupPercent: parseMarkup(o.markupPercent),
  };
}

export function mergeProviderPricing(
  stored: unknown,
  defaults: ProviderPricingPayload = defaultProviderPricing(),
): ProviderPricingPayload {
  if (!stored || typeof stored !== "object") return defaults;
  const root = stored as Record<string, unknown>;

  const llmById = new Map<string, LlmPricingEntry>();
  for (const m of defaults.llm) {
    llmById.set(m.id, { ...m });
  }
  const llmRaw = root.llm;
  if (Array.isArray(llmRaw)) {
    for (const row of llmRaw) {
      const id =
        typeof (row as { id?: string }).id === "string"
          ? (row as { id: string }).id
          : "";
      const parsed = parseLlmRow(row, llmById.get(id));
      if (parsed) llmById.set(parsed.id, parsed);
    }
  } else if (llmRaw && typeof llmRaw === "object") {
    for (const [id, row] of Object.entries(llmRaw as Record<string, unknown>)) {
      const parsed = parseLlmRow({ id, ...(row as object) }, llmById.get(id));
      if (parsed) llmById.set(parsed.id, parsed);
    }
  }

  const ttsByKey = new Map<string, TtsPricingEntry>();
  for (const def of TTS_DEFINITIONS) {
    ttsByKey.set(def.key, {
      ...def,
      usdCost: defaultTtsUsdCost(def.key),
      markupPercent: 0,
    });
  }
  const ttsRaw = root.tts;
  if (Array.isArray(ttsRaw)) {
    for (const row of ttsRaw) {
      const key =
        typeof (row as { key?: string }).key === "string"
          ? (row as { key: string }).key
          : "";
      const def = TTS_DEFINITIONS.find((d) => d.key === key);
      if (def) ttsByKey.set(def.key, parseTtsRow(row, def));
    }
  } else if (ttsRaw && typeof ttsRaw === "object") {
    for (const def of TTS_DEFINITIONS) {
      const row = (ttsRaw as Record<string, unknown>)[def.key];
      if (row !== undefined) {
        ttsByKey.set(def.key, parseTtsRow(row, def));
      }
    }
  }

  return {
    llm: [...llmById.values()],
    tts: TTS_DEFINITIONS.map((d) => ttsByKey.get(d.key)!),
  };
}

export function validateProviderPricingPayload(
  body: unknown,
): { ok: true; value: ProviderPricingPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "providerPricing ungültig" };
  }
  const defaults = defaultProviderPricing();
  const merged = mergeProviderPricing(body, defaults);

  for (const m of merged.llm) {
    if (m.promptCentsPer1k > 10_000 || m.completionCentsPer1k > 10_000) {
      return { ok: false, error: `LLM ${m.id}: Kosten zu hoch` };
    }
  }
  for (const t of merged.tts) {
    if (t.usdCost > 1000) {
      return { ok: false, error: `TTS ${t.key}: USD-Kosten zu hoch` };
    }
  }

  return { ok: true, value: merged };
}

export function applyMarkupPercent(
  baseCents: number,
  markupPercent: number,
): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  if (!markupPercent || markupPercent <= 0) {
    return Math.max(1, Math.ceil(baseCents));
  }
  return Math.max(1, Math.ceil(baseCents * (1 + markupPercent / 100)));
}

const CACHE_TTL_MS = 30_000;
let cache: { pricing: ProviderPricingPayload; at: number } | null = null;

export function invalidateProviderPricingCache(): void {
  cache = null;
  invalidateBillingSettingsCache();
}

export async function fetchProviderPricing(
  supabase?: SupabaseClient | null,
): Promise<ProviderPricingPayload> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.pricing;
  }

  const defaults = defaultProviderPricing();
  const client = supabase ?? createAdminSupabase();
  if (!client) {
    cache = { pricing: defaults, at: Date.now() };
    return defaults;
  }

  const { data, error } = await client
    .from("beta_billing_settings")
    .select("provider_pricing")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data?.provider_pricing) {
    cache = { pricing: defaults, at: Date.now() };
    return defaults;
  }

  const pricing = mergeProviderPricing(data.provider_pricing, defaults);
  cache = { pricing, at: Date.now() };
  return pricing;
}

export function resolveTtsPricingKey(
  provider: "elevenlabs" | "fish" | "openrouter" | "fal",
  modelId?: string,
): string {
  if (provider === "fish") return "fish";
  if (provider === "openrouter") return "openrouter";
  if (provider === "elevenlabs") {
    const model = modelId?.toLowerCase() ?? "";
    if (model.includes("flash") || model.includes("turbo")) {
      return "elevenlabs:flash";
    }
    return "elevenlabs:standard";
  }
  const model = modelId?.toLowerCase() ?? "";
  if (model.includes("kokoro")) return "fal:kokoro";
  if (model.includes("inworld")) return "fal:inworld";
  if (model.includes("elevenlabs")) return "fal:elevenlabs";
  if (model.includes("minimax")) return "fal:minimax";
  if (model.includes("qwen-3-tts") && model.includes("0.6b")) {
    return "fal:qwen-06b";
  }
  if (model.includes("qwen-3-tts")) return "fal:qwen-17b";
  return "fal:default";
}

export function ttsUnitLabel(unit: TtsPricingUnit): string {
  switch (unit) {
    case "per_1m_bytes":
      return "$/1M Bytes";
    case "per_1k_blocks":
      return "$/1k Blöcke";
    default:
      return "$/1k Zeichen";
  }
}

export async function fetchLlmModelCatalog(
  supabase?: SupabaseClient | null,
): Promise<LlmModelOption[]> {
  const pricing = await fetchProviderPricing(supabase);
  return pricing.llm.map((m) => ({
    id: m.id,
    label: m.label,
    promptCentsPer1k: m.promptCentsPer1k,
    completionCentsPer1k: m.completionCentsPer1k,
  }));
}

export function getLlmMarkupPercent(
  pricing: ProviderPricingPayload,
  modelId?: string,
): number {
  const id = modelId?.trim();
  if (!id) return 0;
  return pricing.llm.find((m) => m.id === id)?.markupPercent ?? 0;
}

export function getTtsMarkupPercent(
  pricing: ProviderPricingPayload,
  key: string,
): number {
  return pricing.tts.find((t) => t.key === key)?.markupPercent ?? 0;
}

export function getTtsUsdCost(
  pricing: ProviderPricingPayload,
  key: string,
): number {
  const row = pricing.tts.find((t) => t.key === key);
  return row?.usdCost ?? defaultTtsUsdCost(key);
}
