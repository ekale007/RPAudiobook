import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

function cookiesFromRequest(req?: Request): ReturnType<
  NextRequest["cookies"]["getAll"]
> | null {
  const nextReq = req as NextRequest | undefined;
  if (nextReq?.cookies && typeof nextReq.cookies.getAll === "function") {
    return nextReq.cookies.getAll();
  }
  return null;
}

/** Supabase server client — prefer request cookies in Route Handlers. */
export async function createServerSupabaseFromRequest(req?: Request) {
  const cookieStore = await cookies();
  const reqCookies = req ? cookiesFromRequest(req) : null;
  const authHeader = req?.headers.get("Authorization") ?? undefined;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return reqCookies ?? cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* set from Server Component */
          }
        },
      },
      ...(authHeader
        ? { global: { headers: { Authorization: authHeader } } }
        : {}),
    },
  );
}

/** @deprecated Use createServerSupabaseFromRequest(req) in Route Handlers. */
export async function createServerSupabase() {
  return createServerSupabaseFromRequest();
}
