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

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const hourly = getRateLimitStatus(
    `llm:${auth.user.id}`,
    getRateLimitLlmPerHour(),
  );

  try {
    const monthly = await fetchMonthlyUsage(supabase, auth.user.id);
    return NextResponse.json({
      hourly,
      monthly,
      labels: {
        used: formatCentsDe(monthly.costCents),
        budget: formatCentsDe(monthly.budgetCents),
        remaining: formatCentsDe(monthly.budgetRemainingCents),
      },
    });
  } catch (e) {
    const budgetCents = getBetaLlmBudgetCents();
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
      },
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
