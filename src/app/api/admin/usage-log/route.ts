import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatCentsDe } from "@/lib/server/llmUsage";
import { formatProviderUsd } from "@/lib/server/usageEvents";

/** Admin: usage log for any user (service role). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY fehlt" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId query erforderlich" }, { status: 400 });
  }

  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100,
    500,
  );

  const { data, error } = await admin
    .from("usage_events")
    .select(
      "id, kind, status, label, model_id, provider_ref, prompt_tokens, completion_tokens, characters, cost_cents, provider_cost_usd, duration_ms, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    label: row.label,
    modelId: row.model_id,
    providerRef: row.provider_ref,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    characters: row.characters,
    costCents: row.cost_cents,
    costLabel: formatCentsDe(row.cost_cents as number),
    providerCostLabel: formatProviderUsd(
      row.provider_cost_usd != null
        ? Number(row.provider_cost_usd)
        : null,
    ),
    createdAt: row.created_at,
  }));

  return NextResponse.json({ userId, events });
}
