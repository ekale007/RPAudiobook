import { createClient } from "@/lib/supabase/client";

export async function resolveSupabaseAccessToken(): Promise<string | null> {
  const supabase = createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userError && userData.user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  }

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession();
  if (!refreshError && refreshed.session?.access_token) {
    return refreshed.session.access_token;
  }

  return null;
}

/** Same-origin fetch with Supabase session cookie + Bearer fallback for API routes. */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  try {
    const token = await resolveSupabaseAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    /* proceed without token */
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
