import { NextResponse } from "next/server";
import {
  formatModelPriceHint,
  getLlmModelCatalog,
} from "@/lib/server/llmModels";
import { requireUser } from "@/lib/server/requireUser";

/** Allowed LLM models for user picker (admin catalog via BETA_LLM_MODELS). */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const models = getLlmModelCatalog().map((m) => ({
    id: m.id,
    label: m.label,
    promptCentsPer1k: m.promptCentsPer1k,
    completionCentsPer1k: m.completionCentsPer1k,
    priceHint: formatModelPriceHint(m),
  }));

  return NextResponse.json({ models });
}
