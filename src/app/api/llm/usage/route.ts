import { NextResponse } from "next/server";
import { getRateLimitLlmPerHour, getRateLimitTtsPerHour } from "@/lib/server/env";
import {
  currentUsageMonthUtc,
  fetchMonthlyUsage,
  formatCentsDe,
  getBetaLlmBudgetCents,
} from "@/lib/server/llmUsage";
import { getRateLimitStatus } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { fetchUserTierLimits } from "@/lib/server/userTier";
import { fetchMonthlyTtsUsage } from "@/lib/server/usageEvents";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  let tierLimits;
  try {
    tierLimits = await fetchUserTierLimits(supabase, auth.user.id);
  } catch {
    tierLimits = null;
  }

  const llmPerHour = tierLimits?.llmPerHour ?? getRateLimitLlmPerHour();
  const ttsPerHour = tierLimits?.ttsPerHour ?? getRateLimitTtsPerHour();
  const hourly = getRateLimitStatus(`llm:${auth.user.id}`, llmPerHour);
  const ttsHourly = getRateLimitStatus(`tts:${auth.user.id}`, ttsPerHour);

  const periodMonth = currentUsageMonthUtc();
  let ttsMonthly = {
    periodMonth,
    requestCount: 0,
    characters: 0,
    costCents: 0,
  };
  let ttsWarning: string | undefined;
  try {
    ttsMonthly = await fetchMonthlyTtsUsage(supabase, periodMonth);
  } catch (e) {
    ttsWarning =
      e instanceof Error
        ? e.message
        : "TTS-Verbrauch nicht verfügbar — Migration 010 ausführen";
  }

  try {
    const monthly = await fetchMonthlyUsage(supabase, auth.user.id);
    const totalCostCents = monthly.costCents + ttsMonthly.costCents;
    const ttsSharePct =
      totalCostCents > 0
        ? Math.round((ttsMonthly.costCents / totalCostCents) * 100)
        : 0;
    const llmSharePct =
      totalCostCents > 0
        ? Math.round((monthly.costCents / totalCostCents) * 100)
        : 0;

    return NextResponse.json({
      hourly,
      ttsHourly,
      monthly,
      ttsMonthly,
      total: { costCents: totalCostCents, ttsSharePct, llmSharePct },
      tier: monthly.tier ?? tierLimits?.tier,
      tierLabel: monthly.tierLabel ?? tierLimits?.tierLabel,
      limits: tierLimits,
      labels: {
        used: formatCentsDe(monthly.costCents),
        budget: formatCentsDe(monthly.budgetCents),
        remaining: formatCentsDe(monthly.budgetRemainingCents),
        ttsUsed: formatCentsDe(ttsMonthly.costCents),
        totalUsed: formatCentsDe(totalCostCents),
      },
      ttsWarning,
    });
  } catch (e) {
    const budgetCents =
      tierLimits?.llmBudgetCents ?? getBetaLlmBudgetCents();
    const totalCostCents = ttsMonthly.costCents;
    const ttsSharePct = totalCostCents > 0 ? 100 : 0;
    return NextResponse.json({
      hourly,
      ttsHourly,
      monthly: {
        periodMonth,
        requestCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        costCents: 0,
        budgetCents,
        budgetRemainingCents: budgetCents,
        tier: tierLimits?.tier,
        tierLabel: tierLimits?.tierLabel,
      },
      ttsMonthly,
      total: { costCents: totalCostCents, ttsSharePct, llmSharePct: 0 },
      tier: tierLimits?.tier,
      tierLabel: tierLimits?.tierLabel,
      limits: tierLimits,
      labels: {
        used: formatCentsDe(0),
        budget: formatCentsDe(budgetCents),
        remaining: formatCentsDe(budgetCents),
        ttsUsed: formatCentsDe(ttsMonthly.costCents),
        totalUsed: formatCentsDe(totalCostCents),
      },
      warning:
        e instanceof Error
          ? e.message
          : "Usage table unavailable — run migration 007",
      ttsWarning,
    });
  }
}
