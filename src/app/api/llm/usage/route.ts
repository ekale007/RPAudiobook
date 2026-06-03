import { NextResponse } from "next/server";
import { getRateLimitLlmPerHour } from "@/lib/server/env";
import {
  fetchMonthlyUsage,
  formatCentsDe,
  getBetaLlmBudgetCents,
} from "@/lib/server/llmUsage";
import { getRateLimitStatus } from "@/lib/server/rateLimit";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { fetchUserTierLimits } from "@/lib/server/userTier";

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
  const hourly = getRateLimitStatus(`llm:${auth.user.id}`, llmPerHour);

  try {
    const monthly = await fetchMonthlyUsage(supabase, auth.user.id);
    return NextResponse.json({
      hourly,
      monthly,
      tier: monthly.tier ?? tierLimits?.tier,
      tierLabel: monthly.tierLabel ?? tierLimits?.tierLabel,
      limits: tierLimits,
      labels: {
        used: formatCentsDe(monthly.costCents),
        budget: formatCentsDe(monthly.budgetCents),
        remaining: formatCentsDe(monthly.budgetRemainingCents),
      },
    });
  } catch (e) {
    const budgetCents =
      tierLimits?.llmBudgetCents ?? getBetaLlmBudgetCents();
    return NextResponse.json({
      hourly,
      monthly: {
        periodMonth: new Date().toISOString().slice(0, 7),
        requestCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        costCents: 0,
        budgetCents,
        budgetRemainingCents: budgetCents,
        tier: tierLimits?.tier,
        tierLabel: tierLimits?.tierLabel,
      },
      tier: tierLimits?.tier,
      tierLabel: tierLimits?.tierLabel,
      limits: tierLimits,
      labels: {
        used: formatCentsDe(0),
        budget: formatCentsDe(budgetCents),
        remaining: formatCentsDe(budgetCents),
      },
      warning:
        e instanceof Error
          ? e.message
          : "Usage table unavailable — run migration 007",
    });
  }
}
