import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import {
  formatProviderUsd,
  formatUsd,
  listUsageEvents,
} from "@/lib/server/usageEvents";
import { formatCentsDe } from "@/lib/server/llmUsage";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    200,
  );
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
  );

  const supabase = await createServerSupabaseFromRequest(req);

  try {
    const rows = await listUsageEvents(supabase, auth.user.id, {
      limit,
      offset,
    });
    const events = rows.map((row) => ({
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
      costLabel: formatCentsDe(row.cost_cents),
      providerCostUsd: row.provider_cost_usd,
      providerCostLabel: formatProviderUsd(
        row.provider_cost_usd != null
          ? Number(row.provider_cost_usd)
          : null,
      ),
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    }));

    const totalCents = events.reduce((s, e) => s + e.costCents, 0);

    return NextResponse.json({
      events,
      summary: {
        count: events.length,
        totalCents,
        totalLabel: formatUsd(totalCents),
      },
      pagination: { limit, offset },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Verlauf nicht verfügbar — Migration 010 ausführen",
        events: [],
      },
      { status: 503 },
    );
  }
}
