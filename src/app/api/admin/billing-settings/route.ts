import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import {
  billingSettingsFromEnv,
  formatEurCentsHint,
  invalidateBillingSettingsCache,
} from "@/lib/server/billingSettings";
import {
  ELEVEN_API_USD_PER_1K_FLASH,
  ELEVEN_API_USD_PER_1K_STANDARD,
} from "@/lib/server/elevenLabsApiPricing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchTierLimitsMap,
  invalidateTierLimitsCache,
  tierLimitsFromEnv,
  validateTierLimitsPayload,
  type TierLimitsMap,
} from "@/lib/server/tierLimitsSettings";

function toApiSettings(
  data: Record<string, unknown>,
  usdToEur: number,
) {
  const flash = Number(
    data.tts_usd_per_1k_flash ?? ELEVEN_API_USD_PER_1K_FLASH,
  );
  const standard = Number(
    data.tts_usd_per_1k_standard ?? ELEVEN_API_USD_PER_1K_STANDARD,
  );
  return {
    usdToEurRate: usdToEur,
    ttsUsdPer1kFlash: flash,
    ttsUsdPer1kStandard: standard,
    ttsCentsPer1kChars: Number(data.tts_cents_per_1k_chars ?? 0),
    eurPer1kFlashHint: formatEurCentsHint(flash, usdToEur),
    eurPer1kStandardHint: formatEurCentsHint(standard, usdToEur),
    updatedAt: data.updated_at as string,
  };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const admin = createAdminSupabase();
  const envTierLimits = tierLimitsFromEnv();

  if (!admin) {
    const env = billingSettingsFromEnv();
    return NextResponse.json({
      settings: {
        ...env,
        eurPer1kFlashHint: formatEurCentsHint(
          env.ttsUsdPer1kFlash,
          env.usdToEurRate,
        ),
        eurPer1kStandardHint: formatEurCentsHint(
          env.ttsUsdPer1kStandard,
          env.usdToEurRate,
        ),
      },
      tierLimits: envTierLimits,
      envFallback: true,
      pricingUrl: "https://elevenlabs.io/pricing/api",
      starterPlanNote:
        "Starter: $5/mo, 30k credits — Log nutzt API-$/1k laut Preisliste.",
      warning:
        "SUPABASE_SERVICE_ROLE_KEY fehlt — nur Env-Werte sichtbar, Speichern deaktiviert.",
    });
  }

  const { data, error } = await admin
    .from("beta_billing_settings")
    .select(
      "usd_to_eur_rate, tts_cents_per_1k_chars, tts_usd_per_1k_flash, tts_usd_per_1k_standard, tier_limits, updated_at, updated_by",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    const env = billingSettingsFromEnv();
    return NextResponse.json({
      settings: {
        ...env,
        eurPer1kFlashHint: formatEurCentsHint(
          env.ttsUsdPer1kFlash,
          env.usdToEurRate,
        ),
        eurPer1kStandardHint: formatEurCentsHint(
          env.ttsUsdPer1kStandard,
          env.usdToEurRate,
        ),
      },
      tierLimits: envTierLimits,
      envFallback: true,
      pricingUrl: "https://elevenlabs.io/pricing/api",
      warning: "Migration 012 ausführen (beta_billing_settings).",
    });
  }

  const usdToEur = Number(data.usd_to_eur_rate);
  const tierLimits = await fetchTierLimitsMap(admin);
  return NextResponse.json({
    settings: toApiSettings(data as Record<string, unknown>, usdToEur),
    tierLimits,
    envFallback: false,
    pricingUrl: "https://elevenlabs.io/pricing/api",
    starterPlanNote:
      "Starter: $5/mo, 30k credits — Log nutzt API-$/1k (Flash vs Multilingual/v3).",
    envDefaults: billingSettingsFromEnv(),
    envTierLimits,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY fehlt" },
      { status: 503 },
    );
  }

  let body: {
    usdToEurRate?: number;
    ttsUsdPer1kFlash?: number;
    ttsUsdPer1kStandard?: number;
    tierLimits?: Partial<TierLimitsMap>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  };

  if (body.usdToEurRate !== undefined) {
    const n = Number(body.usdToEurRate);
    if (!Number.isFinite(n) || n <= 0 || n > 5) {
      return NextResponse.json(
        { error: "usdToEurRate muss zwischen 0 und 5 liegen" },
        { status: 400 },
      );
    }
    patch.usd_to_eur_rate = n;
  }

  if (body.ttsUsdPer1kFlash !== undefined) {
    const n = Number(body.ttsUsdPer1kFlash);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json(
        { error: "ttsUsdPer1kFlash ungültig" },
        { status: 400 },
      );
    }
    patch.tts_usd_per_1k_flash = n;
  }

  if (body.ttsUsdPer1kStandard !== undefined) {
    const n = Number(body.ttsUsdPer1kStandard);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json(
        { error: "ttsUsdPer1kStandard ungültig" },
        { status: 400 },
      );
    }
    patch.tts_usd_per_1k_standard = n;
  }

  if (body.tierLimits !== undefined) {
    const validated = validateTierLimitsPayload(body.tierLimits);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    patch.tier_limits = validated.value;
  }

  if (Object.keys(patch).length <= 2) {
    return NextResponse.json(
      { error: "Mindestens ein Feld angeben" },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("beta_billing_settings")
    .upsert({ id: 1, ...patch }, { onConflict: "id" })
    .select(
      "usd_to_eur_rate, tts_cents_per_1k_chars, tts_usd_per_1k_flash, tts_usd_per_1k_standard, tier_limits, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: error.message.includes("does not exist")
          ? "Migration 012/013 auf Supabase ausführen"
          : undefined,
      },
      { status: 500 },
    );
  }

  invalidateBillingSettingsCache();
  invalidateTierLimitsCache();

  const usdToEur = Number(data.usd_to_eur_rate);
  const tierLimits = await fetchTierLimitsMap(admin);
  return NextResponse.json({
    ok: true,
    settings: toApiSettings(data as Record<string, unknown>, usdToEur),
    tierLimits,
  });
}
