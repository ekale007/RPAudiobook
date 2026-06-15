import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatCentsDe } from "@/lib/server/llmUsage";
import { creditWalletAdmin } from "@/lib/server/wallet";

const MAX_CREDIT_CENTS = 50_000;

export async function POST(req: Request) {
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
    userId?: string;
    amountCents?: number;
    amountEur?: number;
    description?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 });
  }

  let amountCents = 0;
  if (typeof body.amountCents === "number" && Number.isFinite(body.amountCents)) {
    amountCents = Math.round(body.amountCents);
  } else if (typeof body.amountEur === "number" && Number.isFinite(body.amountEur)) {
    amountCents = Math.round(body.amountEur * 100);
  } else {
    return NextResponse.json(
      { error: "amountCents oder amountEur erforderlich" },
      { status: 400 },
    );
  }

  if (amountCents < 1) {
    return NextResponse.json(
      { error: "Betrag muss mindestens 0,01 € sein" },
      { status: 400 },
    );
  }
  if (amountCents > MAX_CREDIT_CENTS) {
    return NextResponse.json(
      { error: `Maximal ${formatCentsDe(MAX_CREDIT_CENTS)} pro Gutschrift` },
      { status: 400 },
    );
  }

  const description =
    body.description?.trim() ||
    `Admin-Gutschrift (${formatCentsDe(amountCents)})`;

  try {
    const newBalanceCents = await creditWalletAdmin(
      admin,
      userId,
      amountCents,
      "admin_grant",
      `admin:${auth.user.id}`,
      description,
    );
    return NextResponse.json({
      ok: true,
      userId,
      creditedCents: amountCents,
      creditedEur: formatCentsDe(amountCents),
      walletBalanceCents: newBalanceCents,
      walletBalanceEur: formatCentsDe(newBalanceCents),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("profile_not_found")) {
      return NextResponse.json({ error: "Nutzerprofil nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
