import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

export async function requireUser(
  req: Request,
): Promise<{ user: { id: string } } | { error: Response }> {
  const supabase = await createServerSupabaseFromRequest(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const hasBearer = Boolean(
      req.headers.get("Authorization")?.startsWith("Bearer "),
    );

    return {
      error: new Response(
        JSON.stringify({
          error: "Unauthorized",
          hint: hasBearer
            ? "Bearer token rejected — bitte erneut einloggen."
            : "Keine Session — gleiche URL wie beim Login nutzen (localhost vs. 127.0.0.1).",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  return { user: { id: user.id } };
}
