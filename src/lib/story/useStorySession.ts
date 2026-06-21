"use client";

import { useEffect, useState } from "react";
import { isLocalMode, localDeploymentUserId } from "@/lib/deploymentMode";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type RouterLike = { replace: (path: string) => void };

/** Local placeholder or Supabase user id for story mutations. */
export async function resolveStoryActorId(): Promise<string | null> {
  if (isLocalMode()) return localDeploymentUserId();
  if (!isSupabaseConfigured()) return null;
  const { data } = await createClient().auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Resolves story access: local mode needs no login; SaaS requires Supabase session.
 */
export function useStorySession(router: RouterLike): {
  userId: string | null;
  authReady: boolean;
} {
  const [userId, setUserId] = useState<string | null>(
    isLocalMode() ? localDeploymentUserId() : null,
  );
  const [authReady, setAuthReady] = useState(isLocalMode());

  useEffect(() => {
    if (isLocalMode()) {
      setUserId(localDeploymentUserId());
      setAuthReady(true);
      return;
    }
    if (!isSupabaseConfigured()) {
      router.replace("/");
      return;
    }
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUserId(data.user.id);
        setAuthReady(true);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return { userId, authReady };
}
