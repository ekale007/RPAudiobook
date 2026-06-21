import { NextResponse } from "next/server";
import { isSaasMode } from "@/lib/server/deploymentMode";
import { requireUser } from "@/lib/server/requireUser";
import { resolveLlmChargeCents } from "@/lib/server/llmUsage";
import { estimateTtsCostCents } from "@/lib/server/billingSettings";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!isSaasMode()) {
    return NextResponse.json({ costCents: 0 });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: {
    kind?: "llm" | "tts";
    promptTokens?: number;
    completionTokens?: number;
    modelId?: string;
    providerCostUsd?: number | null;
    characters?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON" }, { status: 400 });
  }

  const supabase = await createServerSupabaseFromRequest(req);

  if (body.kind === "tts") {
    const chars = Math.max(0, Number(body.characters ?? 0));
    const costCents = await estimateTtsCostCents(
      supabase,
      chars,
      body.modelId,
    );
    return NextResponse.json({ costCents });
  }

  const { costCents } = await resolveLlmChargeCents(
    supabase,
    Math.max(0, Number(body.promptTokens ?? 0)),
    Math.max(0, Number(body.completionTokens ?? 0)),
    body.modelId,
    body.providerCostUsd,
  );
  return NextResponse.json({ costCents });
}
