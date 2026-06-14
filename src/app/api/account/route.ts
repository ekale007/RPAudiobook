import { NextResponse } from "next/server";
import { getRateLimitLlmPerHour, getRateLimitTtsPerHour } from "@/lib/server/env";
import {
  fetchMonthlyUsage,
  formatCentsDe,
} from "@/lib/server/llmUsage";
import { getRateLimitStatus } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { countUserTtsRecordings } from "@/lib/server/ttsStorageQuota";
import { fetchTierLimitsMap } from "@/lib/server/tierLimitsSettings";
import { fetchWalletSnapshot } from "@/lib/server/wallet";
import { isStripeConfigured } from "@/lib/server/stripe";
import {
  ensureUserProfile,
  resolveTierLimits,
} from "@/lib/server/userTier";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile;
  let limits;
  try {
    const [p, tierDefaults] = await Promise.all([
      ensureUserProfile(supabase, auth.user.id),
      fetchTierLimitsMap(),
    ]);
    profile = p;
    limits = resolveTierLimits(profile, tierDefaults);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Profil nicht verfügbar — Migration 009 ausführen",
      },
      { status: 503 },
    );
  }

  let monthly = null;
  let monthlyWarning: string | undefined;
  try {
    monthly = await fetchMonthlyUsage(supabase, auth.user.id);
  } catch (e) {
    monthlyWarning =
      e instanceof Error ? e.message : "LLM-Verbrauch nicht verfügbar";
  }

  let ttsUsed = 0;
  try {
    ttsUsed = await countUserTtsRecordings(supabase);
  } catch {
    /* ignore */
  }

  const llmHourly = getRateLimitStatus(
    `llm:${auth.user.id}`,
    limits.llmPerHour,
  );
  const ttsHourly = getRateLimitStatus(
    `tts:${auth.user.id}`,
    limits.ttsPerHour,
  );

  let wallet = null;
  let walletWarning: string | undefined;
  try {
    wallet = await fetchWalletSnapshot(supabase, auth.user.id);
  } catch (e) {
    walletWarning =
      e instanceof Error ? e.message : "Wallet nicht verfügbar — Migration 016";
  }

  return NextResponse.json({
    email: user?.email ?? null,
    userId: auth.user.id,
    displayName: profile.display_name,
    tier: limits.tier,
    tierLabel: limits.tierLabel,
    limits: {
      llmBudgetCents: limits.llmBudgetCents,
      llmBudgetEur: formatCentsDe(limits.llmBudgetCents),
      llmPerHour: limits.llmPerHour,
      ttsPerHour: limits.ttsPerHour,
      ttsStorageMax: limits.ttsStorageMax,
      modelRestricted: Boolean(limits.allowedModelIds?.length),
    },
    monthly,
    monthlyWarning,
    ttsCloud: {
      used: ttsUsed,
      max: limits.ttsStorageMax,
      remaining: Math.max(0, limits.ttsStorageMax - ttsUsed),
    },
    hourly: {
      llm: llmHourly,
      tts: ttsHourly,
    },
    envFallback: {
      llmPerHour: getRateLimitLlmPerHour(),
      ttsPerHour: getRateLimitTtsPerHour(),
    },
    wallet,
    walletWarning,
    stripeConfigured: isStripeConfigured(),
  });
}
