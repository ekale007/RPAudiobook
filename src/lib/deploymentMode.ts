/** SaaS (Supabase + optional Vercel keys) vs local-first (IndexedDB, no cloud account). */

export type DeploymentMode = "saas" | "local";

const LOCAL_USER_ID = "local";

export function getDeploymentMode(): DeploymentMode {
  const forced = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE?.trim().toLowerCase();
  if (forced === "local") return "local";
  if (forced === "saas") return "saas";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && key) return "saas";
  return "local";
}

export function isLocalMode(): boolean {
  return getDeploymentMode() === "local";
}

export function isSaasMode(): boolean {
  return getDeploymentMode() === "saas";
}

/** Placeholder user id for local-only story creation (not stored in cloud). */
export function localDeploymentUserId(): string {
  return LOCAL_USER_ID;
}
