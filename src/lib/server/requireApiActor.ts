import { localDeploymentUserId } from "@/lib/deploymentMode";
import { isSaasMode } from "@/lib/server/deploymentMode";
import { requireUser } from "@/lib/server/requireUser";

/** SaaS: Supabase session required. Local deployment: synthetic local user (no login). */
export async function requireApiActor(
  req: Request,
): Promise<{ user: { id: string } } | { error: Response }> {
  if (!isSaasMode()) {
    return { user: { id: localDeploymentUserId() } };
  }
  return requireUser(req);
}
