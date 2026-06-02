import { NextResponse } from "next/server";
import {
  countUserTtsRecordings,
  getTtsStorageMaxPerUser,
} from "@/lib/server/ttsStorageQuota";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const used = await countUserTtsRecordings(supabase);
  const max = getTtsStorageMaxPerUser();

  return NextResponse.json({
    used,
    max,
    remaining: Math.max(0, max - used),
  });
}
