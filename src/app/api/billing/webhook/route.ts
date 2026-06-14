import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getStripe,
  stripeWebhookSecret,
} from "@/lib/server/stripe";
import { creditWalletAdmin } from "@/lib/server/wallet";

export async function POST(req: Request) {
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY fehlt" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Keine Signatur" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      stripeWebhookSecret(),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("stripe_webhook_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment" || session.payment_status !== "paid") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const userId = session.metadata?.user_id?.trim();
    const metaAmount = Number(session.metadata?.amount_cents);
    const paidCents =
      session.amount_total != null && session.amount_total > 0
        ? session.amount_total
        : metaAmount;

    if (!userId || !Number.isFinite(paidCents) || paidCents <= 0) {
      console.error("stripe webhook: missing user_id or amount", session.id);
      return NextResponse.json({ error: "invalid metadata" }, { status: 400 });
    }

    await creditWalletAdmin(
      admin,
      userId,
      Math.round(paidCents),
      "stripe_topup",
      session.id,
      `Stripe Checkout ${session.id}`,
    );

    if (session.customer) {
      await admin
        .from("user_profiles")
        .update({
          stripe_customer_id: String(session.customer),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  }

  await admin.from("stripe_webhook_events").insert({ event_id: event.id });

  return NextResponse.json({ received: true });
}
