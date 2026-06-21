"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isLocalMode } from "@/lib/deploymentMode";

/** SaaS-only routes redirect home in local-first deployment. */
export function LocalModeRedirect({ children }: { children: ReactNode }) {
  const router = useRouter();
  const local = isLocalMode();

  useEffect(() => {
    if (local) router.replace("/");
  }, [local, router]);

  if (local) return null;
  return children;
}
