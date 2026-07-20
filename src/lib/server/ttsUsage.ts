import type { SupabaseClient } from "@supabase/supabase-js";
import { insertUsageEvent } from "@/lib/server/usageEvents";
import { applyUsageCharge } from "@/lib/server/wallet";

/**
 * Record a TTS usage event AND debit the user's wallet in one shot.
 *
 * Why this is NOT fire-and-forget (no `void`): on Vercel Serverless the
 * runtime freezes the Lambda as soon as the Response leaves — a dangling
 * Promise would be dropped and the wallet never debited, granting free TTS.
 *
 * Order: charge FIRST, log SECOND. InsertUsageEvent has its own soft
 * error-handling (console.warn, no rethrow), but applyUsageCharge must
 * never be skipped because a logging call failed.
 */
export async function recordAndChargeTtsUsage(
  supabase: SupabaseClient,
  input: {
    label: string;
    modelId?: string;
    characters: number;
    costCents: number;
    providerRef?: string | null;
  },
): Promise<void> {
  if (input.costCents <= 0) return;
  try {
    await applyUsageCharge(supabase, input.costCents);
  } catch (e) {
    console.error(`tts usage charge failed (${input.label}):`, e);
    return;
  }
  try {
    await insertUsageEvent(supabase, {
      kind: "tts",
      label: input.label,
      modelId: input.modelId ?? "",
      providerRef: input.providerRef ?? null,
      characters: input.characters,
      costCents: input.costCents,
    });
  } catch (e) {
    console.error("tts usage event logging failed (charge succeeded):", e);
  }
}

export function readElevenLabsUsageHeaders(
  headers: Headers,
): { characters: number; requestId: string | null } {
  const charRaw =
    headers.get("x-character-count") ??
    headers.get("character-cost") ??
    headers.get("xi-character-count");
  const characters = charRaw ? Number.parseInt(charRaw, 10) : 0;
  const requestId =
    headers.get("request-id") ?? headers.get("xi-request-id");
  return {
    characters: Number.isFinite(characters) ? characters : 0,
    requestId: requestId?.trim() || null,
  };
}
