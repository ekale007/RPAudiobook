import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { currentUsageMonthUtc, resetUserLlmUsage } from "@/lib/server/llmUsage";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Admin: reset a user's monthly LLM usage counter (user_llm_usage row). */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY fehlt" },
      { status: 503 },
    );
  }

  let body: { userId?: string; periodMonth?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 });
  }

  const periodMonth = body.periodMonth?.trim() || currentUsageMonthUtc();

  try {
    const result = await resetUserLlmUsage(admin, userId, periodMonth);
    return NextResponse.json({
      ok: true,
      userId,
      periodMonth: result.periodMonth,
      message: `LLM-Verbrauch für ${result.periodMonth} zurückgesetzt.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
