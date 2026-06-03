import { NextResponse } from "next/server";
import { isAdminUserId, requireAdmin } from "@/lib/server/adminAuth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    isAdmin: true,
    userId: auth.user.id,
    email: user?.email ?? null,
    serviceRoleConfigured: Boolean(createAdminSupabase()),
    adminIdsConfigured: Boolean(process.env.ADMIN_USER_IDS?.trim()),
  });
}

/** Dev helper: check if current user would be admin (no 403). */
export async function HEAD(req: Request) {
  const supabase = await createServerSupabaseFromRequest(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  return new Response(null, {
    status: isAdminUserId(user.id) ? 200 : 403,
  });
}
