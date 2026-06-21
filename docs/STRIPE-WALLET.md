# Wallet & Stripe — Setup

Prepaid-Guthaben für LLM und TTS. Free-Tier: **2 € Gratis pro Woche** (Mo UTC), danach Wallet. Beta: **5 € Startguthaben** bei Admin-Tier-Wechsel (einmalig). Aufladen ab **5 €** via Stripe.

## 1. Supabase Migration

Schema für Wallet/Stripe auf der **Betreiber-Supabase** anwenden (SQL nicht im öffentlichen OSS-Repo).

Neue Spalten auf `user_profiles`: `wallet_balance_cents`, `stripe_customer_id`, `beta_welcome_credit_granted`.  
Neue Tabellen: `user_weekly_usage`, `wallet_transactions`, `stripe_webhook_events`.  
RPCs: `charge_usage`, `credit_wallet` (nur service_role).

## 2. Stripe Account

1. [dashboard.stripe.com](https://dashboard.stripe.com) — Account anlegen (Deutschland, EUR).
2. **Developers → API keys**: `STRIPE_SECRET_KEY` (Test: `sk_test_…`, Live: `sk_live_…`).
3. **Developers → Webhooks → Add endpoint**:
   - URL Produktion: `https://<deine-domain>/api/billing/webhook`
   - Events: `checkout.session.completed`
   - Signing secret → `STRIPE_WEBHOOK_SECRET` (`whsec_…`)

Lokal mit Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
# Ausgabe: whsec_… für STRIPE_WEBHOOK_SECRET
```

## 3. Umgebungsvariablen (Vercel / `.env.local`)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://deine-domain.com

# Optional (Defaults siehe .env.example)
BETA_TIER_FREE_WEEKLY_BUDGET_CENTS=200
BETA_TIER_BETA_WELCOME_CREDIT_CENTS=500
STRIPE_TOPUP_MIN_CENTS=500
STRIPE_TOPUP_MAX_CENTS=20000
```

`SUPABASE_SERVICE_ROLE_KEY` muss gesetzt sein (Webhook-Gutschrift via `credit_wallet`).

## 4. Ablauf

| Tarif | Gratis | Wallet | Aufladen |
|-------|--------|--------|----------|
| free  | 2 €/Woche, dann Wallet | optional | Stripe Checkout |
| beta  | — | 5 € einmalig (Admin) | Stripe Checkout |
| pro   | — | nur Wallet | Stripe Checkout (BYOK später) |

Verbrauch: `charge_usage` zieht zuerst Free-Wochenbudget (nur `free`), dann Wallet.  
LLM + alle Server-TTS-Routen prüfen Guthaben vor der Anfrage.

## 5. Test

1. Free-User: Chat/TTS bis ~2 € diese Woche → dann `insufficient_balance` ohne Wallet.
2. Account → Guthaben → Stripe Testkarte `4242 4242 4242 4242`.
3. Nach Webhook: Wallet erhöht, `wallet_transactions` Eintrag `stripe_topup`.
4. Admin: User auf `beta` → `beta_welcome` 5 € wenn noch nicht `beta_welcome_credit_granted`.

## API

- `GET /api/billing/config` — Min/Max Aufladung, Stripe aktiv
- `POST /api/billing/checkout` — `{ "amountCents": 500 }` → `{ "url" }`
- `POST /api/billing/webhook` — Stripe only (raw body)
- `POST /api/admin/wallet-credit` — Admin: `{ "userId", "amountEur" }` → Wallet-Gutschrift (auch über `/admin` UI)
