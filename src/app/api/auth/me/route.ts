import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

/** Debug: does the server see your Supabase session? Open while logged in. */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseFromRequest(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "No user",
        hasBearer: Boolean(req.headers.get("Authorization")),
        cookieCount: req.cookies.getAll().length,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, userId: user.id });
}
