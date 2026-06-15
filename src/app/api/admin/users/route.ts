import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { currentUsageMonthUtc } from "@/lib/server/llmUsage";
import { fetchTierLimitsMap } from "@/lib/server/tierLimitsSettings";
import { grantBetaWelcomeCreditIfNeeded } from "@/lib/server/wallet";
import {
  resolveTierLimits,
  type UserTier,
} from "@/lib/server/userTier";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY nicht gesetzt — Admin-Liste benötigt Service Role.",
      },
      { status: 503 },
    );
  }

  const periodMonth = currentUsageMonthUtc();
  const tierDefaults = await fetchTierLimitsMap(admin);

  const { data: profiles, error: profileErr } = await admin
    .from("user_profiles")
    .select(
      "user_id, tier, email, display_name, wallet_balance_cents, llm_budget_cents_override, llm_hourly_limit_override, tts_hourly_limit_override, tts_storage_max_override, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const { data: usageRows, error: usageErr } = await admin
    .from("user_llm_usage")
    .select("user_id, request_count, cost_cents, prompt_tokens, completion_tokens")
    .eq("period_month", periodMonth);

  if (usageErr) {
    return NextResponse.json({ error: usageErr.message }, { status: 500 });
  }

  const usageByUser = new Map(
    (usageRows ?? []).map((r) => [
      r.user_id as string,
      {
        requestCount: r.request_count as number,
        costCents: r.cost_cents as number,
        promptTokens: Number(r.prompt_tokens ?? 0),
        completionTokens: Number(r.completion_tokens ?? 0),
      },
    ]),
  );

  const users = (profiles ?? []).map((p) => {
    const uid = p.user_id as string;
    const usage = usageByUser.get(uid);
    const profile = {
      user_id: uid,
      tier: p.tier as UserTier,
      display_name: (p.display_name as string | null) ?? null,
      llm_budget_cents_override:
        (p.llm_budget_cents_override as number | null) ?? null,
      llm_hourly_limit_override:
        (p.llm_hourly_limit_override as number | null) ?? null,
      tts_hourly_limit_override:
        (p.tts_hourly_limit_override as number | null) ?? null,
      tts_storage_max_override:
        (p.tts_storage_max_override as number | null) ?? null,
    };
    const limits = resolveTierLimits(profile, tierDefaults);
    return {
      userId: uid,
      email: (p.email as string | null) ?? null,
      displayName: (p.display_name as string | null) ?? null,
      tier: limits.tier,
      limits: {
        llmBudgetCents: limits.llmBudgetCents,
        llmPerHour: limits.llmPerHour,
        ttsPerHour: limits.ttsPerHour,
        ttsStorageMax: limits.ttsStorageMax,
      },
      overrides: {
        llmBudgetCents: profile.llm_budget_cents_override,
        llmHourly: profile.llm_hourly_limit_override,
        ttsHourly: profile.tts_hourly_limit_override,
        ttsStorage: profile.tts_storage_max_override,
      },
      usage: usage ?? {
        requestCount: 0,
        costCents: 0,
        promptTokens: 0,
        completionTokens: 0,
      },
      walletBalanceCents: Number(p.wallet_balance_cents ?? 0),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });

  return NextResponse.json({ periodMonth, users });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY fehlt" },
      { status: 503 },
    );
  }

  let body: {
    userId?: string;
    tier?: UserTier;
    llmBudgetCentsOverride?: number | null;
    llmHourlyLimitOverride?: number | null;
    ttsHourlyLimitOverride?: number | null;
    ttsStorageMaxOverride?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.tier === "free" || body.tier === "beta" || body.tier === "pro") {
    patch.tier = body.tier;
  }
  if (body.llmBudgetCentsOverride !== undefined) {
    patch.llm_budget_cents_override = body.llmBudgetCentsOverride;
  }
  if (body.llmHourlyLimitOverride !== undefined) {
    patch.llm_hourly_limit_override = body.llmHourlyLimitOverride;
  }
  if (body.ttsHourlyLimitOverride !== undefined) {
    patch.tts_hourly_limit_override = body.ttsHourlyLimitOverride;
  }
  if (body.ttsStorageMaxOverride !== undefined) {
    patch.tts_storage_max_override = body.ttsStorageMaxOverride;
  }

  const { error } = await admin
    .from("user_profiles")
    .update(patch)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let betaWelcomeGranted = false;
  if (body.tier === "beta") {
    try {
      betaWelcomeGranted = await grantBetaWelcomeCreditIfNeeded(admin, userId);
    } catch (e) {
      console.error("grantBetaWelcomeCreditIfNeeded:", e);
    }
  }

  return NextResponse.json({ ok: true, userId, patch, betaWelcomeGranted });
}
