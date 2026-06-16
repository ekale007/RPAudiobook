import { NextResponse } from "next/server";
import {
  formatModelPriceHint,
} from "@/lib/server/llmModels";
import { fetchLlmModelCatalog } from "@/lib/server/providerPricing";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import {
  fetchUserTierLimits,
  filterCatalogForTier,
} from "@/lib/server/userTier";

/** Allowed LLM models for user picker (admin catalog via BETA_LLM_MODELS). */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseFromRequest(req);
  let limits;
  try {
    limits = await fetchUserTierLimits(supabase, auth.user.id);
  } catch {
    limits = null;
  }

  const catalogBase = await fetchLlmModelCatalog(supabase);
  const catalog = limits
    ? filterCatalogForTier(catalogBase, limits)
    : catalogBase;

  const models = catalog.map((m) => ({
    id: m.id,
    label: m.label,
    promptCentsPer1k: m.promptCentsPer1k,
    completionCentsPer1k: m.completionCentsPer1k,
    priceHint: formatModelPriceHint(m),
  }));

  return NextResponse.json({
    models,
    tier: limits?.tier ?? null,
    tierLabel: limits?.tierLabel ?? null,
  });
}
