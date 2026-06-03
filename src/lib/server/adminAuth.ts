import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

function adminIdSet(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS?.trim() ?? "";
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAdminUserId(userId: string): boolean {
  const ids = adminIdSet();
  if (!ids.size) return false;
  return ids.has(userId);
}

export async function requireAdmin(
  req: Request,
): Promise<{ user: { id: string } } | { error: Response }> {
  const supabase = await createServerSupabaseFromRequest(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  if (!isAdminUserId(user.id)) {
    return {
      error: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { user: { id: user.id } };
}
