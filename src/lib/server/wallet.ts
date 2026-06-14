import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { formatCentsDe } from "@/lib/server/llmUsage";
import type { UserTier } from "@/lib/server/userTier";
import { ensureUserProfile } from "@/lib/server/userTier";

export type WalletSnapshot = {
  walletBalanceCents: number;
  walletBalanceEur: string;
  tier: UserTier;
  periodWeek: string;
  weeklyFreeBudgetCents: number;
  weeklyFreeUsedCents: number;
  weeklyFreeRemainingCents: number;
  spendableCents: number;
};

const DEFAULT_FREE_WEEKLY_BUDGET_CENTS = 200;
const DEFAULT_BETA_WELCOME_CREDIT_CENTS = 500;
const DEFAULT_TOPUP_MIN_CENTS = 500;
const DEFAULT_TOPUP_MAX_CENTS = 200_00;

export function getFreeWeeklyBudgetCents(): number {
  const raw = process.env.BETA_TIER_FREE_WEEKLY_BUDGET_CENTS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_FREE_WEEKLY_BUDGET_CENTS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FREE_WEEKLY_BUDGET_CENTS;
}

export function getBetaWelcomeCreditCents(): number {
  const raw = process.env.BETA_TIER_BETA_WELCOME_CREDIT_CENTS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_BETA_WELCOME_CREDIT_CENTS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BETA_WELCOME_CREDIT_CENTS;
}

export function getWalletTopupMinCents(): number {
  const raw = process.env.STRIPE_TOPUP_MIN_CENTS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_TOPUP_MIN_CENTS;
  return Number.isFinite(n) && n >= 100 ? n : DEFAULT_TOPUP_MIN_CENTS;
}

export function getWalletTopupMaxCents(): number {
  const raw = process.env.STRIPE_TOPUP_MAX_CENTS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_TOPUP_MAX_CENTS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TOPUP_MAX_CENTS;
}

export function currentUsageWeekUtc(): string {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - day + 1,
  ));
  return monday.toISOString().slice(0, 10);
}

export async function fetchWalletBalanceCents(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("wallet_balance_cents")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.wallet_balance_cents ?? 0);
}

export async function fetchWeeklyFreeUsedCents(
  supabase: SupabaseClient,
  userId: string,
  periodWeek = currentUsageWeekUtc(),
): Promise<number> {
  const { data, error } = await supabase
    .from("user_weekly_usage")
    .select("cost_cents")
    .eq("user_id", userId)
    .eq("period_week", periodWeek)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.cost_cents ?? 0);
}

export async function fetchWalletSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<WalletSnapshot> {
  const profile = await ensureUserProfile(supabase, userId);
  const periodWeek = currentUsageWeekUtc();
  const walletBalanceCents = await fetchWalletBalanceCents(supabase, userId);
  const weeklyBudget = getFreeWeeklyBudgetCents();
  const weeklyUsed =
    profile.tier === "free"
      ? await fetchWeeklyFreeUsedCents(supabase, userId, periodWeek)
      : 0;
  const weeklyFreeRemainingCents =
    profile.tier === "free"
      ? Math.max(0, weeklyBudget - weeklyUsed)
      : 0;
  const spendableCents = walletBalanceCents + weeklyFreeRemainingCents;

  return {
    walletBalanceCents,
    walletBalanceEur: formatCentsDe(walletBalanceCents),
    tier: profile.tier,
    periodWeek,
    weeklyFreeBudgetCents: weeklyBudget,
    weeklyFreeUsedCents: weeklyUsed,
    weeklyFreeRemainingCents,
    spendableCents,
  };
}

export async function canSpend(
  supabase: SupabaseClient,
  userId: string,
  minCents: number,
): Promise<{ ok: true; snapshot: WalletSnapshot } | { ok: false; snapshot: WalletSnapshot; code: string; message: string }> {
  const snapshot = await fetchWalletSnapshot(supabase, userId);
  const need = Math.max(1, minCents);
  if (snapshot.spendableCents < need) {
    return {
      ok: false,
      snapshot,
      code: "insufficient_balance",
      message:
        snapshot.tier === "free"
          ? "Gratis-Wochenbudget und Guthaben aufgebraucht — bitte aufladen (min. 5 €)."
          : "Guthaben aufgebraucht — bitte aufladen (min. 5 €).",
    };
  }
  return { ok: true, snapshot };
}

export function insufficientBalanceResponse(
  snapshot: WalletSnapshot,
  message?: string,
): NextResponse {
  return NextResponse.json(
    {
      error: message ?? "Guthaben nicht ausreichend",
      code: "insufficient_balance",
      wallet: snapshot,
    },
    { status: 429 },
  );
}

export async function requireSpendableBalance(
  supabase: SupabaseClient,
  userId: string,
  minCents = 1,
): Promise<NextResponse | null> {
  const check = await canSpend(supabase, userId, minCents);
  if (!check.ok) {
    return insufficientBalanceResponse(check.snapshot, check.message);
  }
  return null;
}

export async function applyUsageCharge(
  supabase: SupabaseClient,
  costCents: number,
): Promise<void> {
  if (costCents <= 0) return;
  const { error } = await supabase.rpc("charge_usage", {
    p_cost_cents: costCents,
  });
  if (error) {
    if (error.message.includes("insufficient_balance")) {
      console.warn("charge_usage: insufficient_balance after request");
      return;
    }
    throw error;
  }
}

export async function creditWalletAdmin(
  admin: SupabaseClient,
  userId: string,
  amountCents: number,
  kind: string,
  reference?: string | null,
  description?: string | null,
): Promise<number> {
  const { data, error } = await admin.rpc("credit_wallet", {
    p_user_id: userId,
    p_amount_cents: amountCents,
    p_kind: kind,
    p_reference: reference ?? null,
    p_description: description ?? null,
  });
  if (error) throw error;
  const row = data as { wallet_balance_cents?: number } | null;
  return Number(row?.wallet_balance_cents ?? 0);
}

export async function grantBetaWelcomeCreditIfNeeded(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: profile, error: fetchErr } = await admin
    .from("user_profiles")
    .select("tier, beta_welcome_credit_granted")
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!profile || profile.tier !== "beta" || profile.beta_welcome_credit_granted) {
    return false;
  }

  const amount = getBetaWelcomeCreditCents();
  await creditWalletAdmin(
    admin,
    userId,
    amount,
    "beta_welcome",
    null,
    "Beta-Tester Startguthaben",
  );

  const { error: updErr } = await admin
    .from("user_profiles")
    .update({
      beta_welcome_credit_granted: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updErr) throw updErr;
  return true;
}
