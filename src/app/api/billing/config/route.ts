import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/server/stripe";
import {
  getFreeWeeklyBudgetCents,
  getWalletTopupMaxCents,
  getWalletTopupMinCents,
} from "@/lib/server/wallet";
import { formatCentsDe } from "@/lib/server/llmUsage";

export async function GET() {
  const minCents = getWalletTopupMinCents();
  const maxCents = getWalletTopupMaxCents();
  const weeklyCents = getFreeWeeklyBudgetCents();

  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    topupMinCents: minCents,
    topupMaxCents: maxCents,
    topupMinEur: formatCentsDe(minCents),
    topupMaxEur: formatCentsDe(maxCents),
    freeWeeklyBudgetCents: weeklyCents,
    freeWeeklyBudgetEur: formatCentsDe(weeklyCents),
  });
}
