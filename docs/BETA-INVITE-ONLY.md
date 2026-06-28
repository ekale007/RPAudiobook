# Beta-Auth: Invite-Only Setup

Status: **AKTIVIERT am 2026-06-28** — RP Audiobook läuft im Invite-Only-Modus.

Diese Anleitung beschreibt die Schritte, um die Beta in den **Invite-Only-Modus** zu schalten. Kombiniert aus Code (`NEXT_PUBLIC_BETA_INVITE_ONLY=1`) + Supabase Dashboard.

---

## Was Invite-Only bedeutet

- ✅ **Erlaubt:** Eingeladene User können sich einloggen, neue User bekommen Supabase-Invite
- ❌ **Verboten:** Öffentliche Registrierung via `/signup` (UI versteckt Formular, Server redirected, Supabase lehnt 403 ab)

---

## Code-Änderungen (automatisch im Codebase aktiv)

| Datei | Was passiert |
|---|---|
| `src/lib/auth/betaAuth.ts` | `isInviteOnlyBeta()` liest `NEXT_PUBLIC_BETA_INVITE_ONLY=1` |
| `src/app/signup/page.tsx` | Server-side `redirect('/login')` im Invite-Modus |
| `src/app/login/page.tsx` | UI zeigt "Keinen Invite?"-Hinweis + Waitlist-Link |
| `public/robots.txt` | Disallow `/signup/` (kein SEO-Traffic) |

---

## Supabase Dashboard (manuell)

Gehe zu **https://supabase.com/dashboard** → dein Projekt.

### Schritt 1 — Sign-up deaktivieren

**Authentication → Providers → Email:**
- **Confirm email:** AN (sicherer, User müssen E-Mail bestätigen)
- **Allow new users to sign up:** **OFF** ← DAS IST DER WICHTIGE SCHALTER

> ⚠️ Wenn "Allow new users to sign up" AN bleibt, kann sich **jeder** über `/signup` registrieren, unabhängig vom `NEXT_PUBLIC_BETA_INVITE_ONLY` Flag. Code-Schutz allein reicht nicht.

### Schritt 2 — Anonymen Login deaktivieren

**Authentication → Providers → Anonymous:**
- **OFF** (außer du willst anonyme User — default: aus)

### Schritt 3 — URL Configuration prüfen

**Authentication → URL Configuration:**

| Feld | Wert |
|------|------|
| **Site URL** | `https://rp-audiobook.vercel.app` |
| **Redirect URLs** | `https://rp-audiobook.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` (Dev) |

### Schritt 4 — OAuth-Provider (optional)

Falls du OAuth willst (Google/GitHub/Discord), aktiviere sie hier. **Aber:** OAuth-User können sich **ohne Invite** einloggen, wenn die Provider aktiv sind.

**Empfehlung für geschlossene Beta:** OAuth **komplett deaktiviert** lassen. Später für offene Beta aktivieren.

### Schritt 5 — Invite-Workflow testen

1. **Authentication → Users → "Add user" → "Create new user"**
   - Email + Passwort setzen
   - **"Auto Confirm User"** anhaken (sonst muss User erst E-Mail bestätigen)
2. Login mit den Credentials testen
3. Erster Login: Tier ist `free`. Im Admin-UI oder per SQL auf `beta` setzen

### Schritt 6 — SMTP konfigurieren (empfohlen)

**Project Settings → Authentication → SMTP Settings:**

Free-Tier: ~3 Auth-Mails/Stunde (zu wenig für echten Betrieb). Konfiguriere SMTP (z.B. Resend, Brevo, Mailgun).

---

## Vercel Environment Variables

In **Vercel Dashboard → Project → Settings → Environment Variables:**

| Variable | Wert | Sichtbarkeit |
|----------|------|--------------|
| `NEXT_PUBLIC_BETA_INVITE_ONLY` | `1` | Public (client) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Server only** |
| `ADMIN_USER_IDS` | `uuid-1,uuid-2` | Server only |

`NEXT_PUBLIC_BETA_INVITE_ONLY=1` ist der Hauptschalter im App-Code.

---

## Test-Checkliste

Vor dem Launch testen:

- [ ] **Visit `/signup` → redirected to `/login`**
- [ ] **Try to call `supabase.auth.signUp()` from devtools** → bekommt 403 "Signups not allowed"
- [ ] **Login mit Invite-Account funktioniert**
- [ ] **Login mit unbekanntem Account** → saubere Fehlermeldung (kein Hinweis ob Account existiert — Security)
- [ ] **Reset-Passwort funktioniert** (SMTP)
- [ ] **OAuth-Buttons** (falls aktiv) — funktionieren wie Invite (kein Public-Signup)

---

## Später: Offene Beta

Wenn du den Invite-Lock aufhebst:

1. **Vercel:** `NEXT_PUBLIC_BETA_INVITE_ONLY` auf `0` (oder löschen)
2. **Supabase:** "Allow new users to sign up" → **ON**
3. Optional: OAuth-Provider aktivieren
4. **/signup** wird automatisch wieder sichtbar (UI + kein Redirect mehr)
5. **/login** zeigt wieder "Account erstellen"-Link

Kein Code-Change nötig — alles über Env-Var.

---

## Verwandte Docs

- [`BETA-AUTH.md`](./BETA-AUTH.md) — Generelle Auth-Doku
- [`BETA-BILLING.md`](./BETA-BILLING.md) — Tier-System (free/beta/pro)
- [`SMOKE-TEST.md`](./SMOKE-TEST.md) — Pre-Launch-Checkliste
- [`BETA-LAUNCH-PLAN.md`](./BETA-LAUNCH-PLAN.md) — Gesamt-Plan
