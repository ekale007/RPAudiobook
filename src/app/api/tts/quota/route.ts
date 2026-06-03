import { NextResponse } from "next/server";
import { countUserTtsRecordings } from "@/lib/server/ttsStorageQuota";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { fetchUserTierLimits } from "@/lib/server/userTier";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const used = await countUserTtsRecordings(supabase);
  let max = 100;
  let tierLabel = "Beta";
  try {
    const limits = await fetchUserTierLimits(supabase, auth.user.id);
    max = limits.ttsStorageMax;
    tierLabel = limits.tierLabel;
  } catch {
    /* migration 009 missing */
  }

  return NextResponse.json({
    used,
    max,
    remaining: Math.max(0, max - used),
    tierLabel,
  });
}
