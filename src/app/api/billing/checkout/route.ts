import { brand } from "@/lib/brand";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { createServerSupabaseFromRequest } from "@/lib/supabase/server";
import {
  getStripe,
  isStripeConfigured,
  publicSiteUrl,
} from "@/lib/server/stripe";
import {
  getWalletTopupMaxCents,
  getWalletTopupMinCents,
} from "@/lib/server/wallet";
import { ensureUserProfile } from "@/lib/server/userTier";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { saasOnlyGuard } from "@/lib/server/saasOnly";

export async function POST(req: Request) {
  const blocked = saasOnlyGuard();
  if (blocked) return blocked;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe noch nicht konfiguriert (STRIPE_SECRET_KEY)" },
      { status: 503 },
    );
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let body: { amountCents?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON" }, { status: 400 });
  }

  const minCents = getWalletTopupMinCents();
  const maxCents = getWalletTopupMaxCents();
  const amountCents = Number(body.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < minCents || amountCents > maxCents) {
    return NextResponse.json(
      {
        error: `Betrag zwischen ${minCents / 100} € und ${maxCents / 100} € erforderlich`,
        minCents,
        maxCents,
      },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseFromRequest(req);
  const profile = await ensureUserProfile(supabase, auth.user.id);

  const stripe = getStripe();
  const siteUrl = publicSiteUrl();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let customerId: string | null = null;
  const { data: row } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  customerId = (row?.stripe_customer_id as string | null) ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: authUser?.email ?? undefined,
      metadata: { user_id: auth.user.id },
    });
    customerId = customer.id;
    const admin = createAdminSupabase();
    if (admin) {
      await admin
        .from("user_profiles")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", auth.user.id);
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: brand.walletProductName,
            description: `Prepaid-Guthaben für LLM und TTS (${profile.tier})`,
          },
          unit_amount: Math.round(amountCents),
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: auth.user.id,
      amount_cents: String(Math.round(amountCents)),
    },
    success_url: `${siteUrl}/account?topup=success`,
    cancel_url: `${siteUrl}/account?topup=cancel`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Checkout-URL konnte nicht erstellt werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
