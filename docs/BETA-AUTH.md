# Beta-Auth: E-Mail-Login

Zwei Betriebsarten:

1. **Offene Registrierung** (Standard): Nutzer können sich mit E-Mail + Passwort anmelden und **Account erstellen**.
2. **Invite-only**: Nur bestehende / eingeladene Accounts, kein öffentliches Registrieren.

## Supabase Dashboard (Pflicht)

Projekt: [Supabase Dashboard](https://supabase.com/dashboard) → dein Projekt

### 1. URL Configuration

**Authentication → URL Configuration**

| Feld | Wert (Prod) |
|------|-------------|
| **Site URL** | `https://rp-audiobook-snowy.vercel.app` (oder deine Hauptdomain) |
| **Redirect URLs** | `https://rp-audiobook-snowy.vercel.app/auth/callback` |
| | `https://rp-audiobook.vercel.app/auth/callback` (falls Alias) |
| | `http://localhost:3000/auth/callback` (Dev) |

### 2. E-Mail-Provider

**Authentication → Providers → Email**

- Email provider: **ON**
- **Confirm email**: optional AUS (schnellerer Einstieg; sonst Bestätigungs-Mail)
- **Allow new users to sign up**: **ON** für offene Beta, **OFF** nur im Invite-only-Modus

### 3. Anonym deaktivieren (Prod)

**Authentication → Providers → Anonymous** → **OFF**

### 4. Invite-only (optional)

Nur wenn Sign-up in Supabase **aus** ist:

**Authentication → Users → Invite user** — Supabase schickt Invite-Link.

### 5. SMTP (empfohlen)

Free-Tier: wenige Auth-Mails pro Stunde. Für mehr Nutzer: **Project Settings → Authentication → SMTP**.

---

## App / Vercel

| Variable | Offene Beta | Invite-only |
|----------|-------------|-------------|
| `NEXT_PUBLIC_BETA_INVITE_ONLY` | leer / `0` | `1` |
| `NEXT_PUBLIC_OAUTH_PROVIDERS` | `google,github,discord` (optional) | gleich — OAuth-Login auch für eingeladene Nutzer |

Wenn **nicht** gesetzt bzw. `0`:

- Button **Account erstellen** auf `/login`
- Hinweis: Anmelden oder registrieren

Wenn `1`:

- Kein „Account erstellen“
- Hinweis: „Beta — Zugang nur mit Einladung“

Neue Nutzer starten mit Tarif `free` (Profil wird beim ersten API-Call angelegt). Tarif und Limits in der **Admin-UI** (`/admin`) oder Supabase `user_profiles` setzen — siehe [BETA-BILLING.md](./BETA-BILLING.md).

Migration **015** (`tier_limits` in `beta_billing_settings`) auf Supabase ausführen, damit Tarif-Limits in der Admin-UI speicherbar sind.

## Checkliste — offene Beta

- [ ] Sign-up in Supabase **an**
- [ ] `NEXT_PUBLIC_BETA_INVITE_ONLY` auf Vercel **nicht** auf `1`
- [ ] Anonymous **aus**
- [ ] Redirect URLs für Prod eingetragen
- [ ] Test: Account erstellen → Login OK
- [ ] Migration 015 angewendet (Admin Tarif-Limits)

## Checkliste — Invite-only

- [ ] Sign-up in Supabase **aus**
- [ ] `NEXT_PUBLIC_BETA_INVITE_ONLY=1` auf Vercel
- [ ] Test-Invite → Link → Passwort → Login OK

## Fehlerbilder

| Symptom | Lösung |
|---------|--------|
| „Signups not allowed“ | Sign-up in Supabase aktivieren oder Invite nutzen |
| Invite-Link landet auf localhost | Site URL / Redirect URLs prüfen |
| „Email rate limit“ | Warten oder SMTP konfigurieren |

Siehe auch: [AUTH.md](./AUTH.md), [DEPLOY.md](./DEPLOY.md)
