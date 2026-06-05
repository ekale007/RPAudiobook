import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageEventKind = "llm" | "tts";

export type UsageEventRow = {
  id: string;
  kind: UsageEventKind;
  status: string;
  label: string | null;
  model_id: string | null;
  provider_ref: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  characters: number;
  cost_cents: number;
  provider_cost_usd: number | null;
  duration_ms: number | null;
  created_at: string;
};

export type InsertUsageEventInput = {
  kind: UsageEventKind;
  status?: "ok" | "error";
  label?: string;
  modelId?: string;
  providerRef?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  characters?: number;
  costCents: number;
  providerCostUsd?: number | null;
  durationMs?: number;
  storyId?: string | null;
};

export async function insertUsageEvent(
  supabase: SupabaseClient,
  input: InsertUsageEventInput,
): Promise<void> {
  const { error } = await supabase.rpc("insert_usage_event", {
    p_kind: input.kind,
    p_status: input.status ?? "ok",
    p_label: input.label ?? "",
    p_model_id: input.modelId ?? "",
    p_provider_ref: input.providerRef ?? "",
    p_prompt_tokens: input.promptTokens ?? 0,
    p_completion_tokens: input.completionTokens ?? 0,
    p_characters: input.characters ?? 0,
    p_cost_cents: input.costCents,
    p_provider_cost_usd: input.providerCostUsd ?? null,
    p_duration_ms: input.durationMs ?? null,
    p_story_id: input.storyId ?? null,
  });
  if (error) {
    console.warn("insert_usage_event:", error.message);
  }
}

export async function listUsageEvents(
  supabase: SupabaseClient,
  userId: string,
  options?: { limit?: number; offset?: number },
): Promise<UsageEventRow[]> {
  const limit = Math.min(options?.limit ?? 50, 200);
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from("usage_events")
    .select(
      "id, kind, status, label, model_id, provider_ref, prompt_tokens, completion_tokens, characters, cost_cents, provider_cost_usd, duration_ms, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as UsageEventRow[];
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cents / 100);
}

export function formatProviderUsd(usd: number | null): string | null {
  if (usd == null || !Number.isFinite(usd)) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(usd);
}

export type MonthlyTtsUsageSnapshot = {
  periodMonth: string;
  requestCount: number;
  characters: number;
  costCents: number;
};

function monthBoundsUtc(periodMonth: string): { start: string; end: string } {
  const [y, m] = periodMonth.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    end: new Date(Date.UTC(y, m, 1)).toISOString(),
  };
}

/** Sum TTS rows from usage_events for the calendar month (UTC). */
export async function fetchMonthlyTtsUsage(
  supabase: SupabaseClient,
  periodMonth: string = new Date().toISOString().slice(0, 7),
): Promise<MonthlyTtsUsageSnapshot> {
  const { start, end } = monthBoundsUtc(periodMonth);
  const { data, error } = await supabase
    .from("usage_events")
    .select("cost_cents, characters")
    .eq("kind", "tts")
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) throw error;

  let requestCount = 0;
  let characters = 0;
  let costCents = 0;
  for (const row of data ?? []) {
    requestCount += 1;
    characters += Number(row.characters ?? 0);
    costCents += Number(row.cost_cents ?? 0);
  }

  return { periodMonth, requestCount, characters, costCents };
}
