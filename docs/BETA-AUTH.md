# Beta-Auth: nur eingeladene Gäste

Die App kann im **Invite-only**-Modus laufen: Login nur für bestehende / eingeladene Accounts, kein öffentliches Registrieren.

## Supabase Dashboard (Pflicht)

Projekt: [Supabase Dashboard](https://supabase.com/dashboard) → dein Projekt (`phyzqtxuhbodhupgbnfp` o. ä.)

### 1. URL Configuration

**Authentication → URL Configuration**

| Feld | Wert (Prod) |
|------|-------------|
| **Site URL** | `https://rp-audiobook-snowy.vercel.app` (oder deine Hauptdomain) |
| **Redirect URLs** | `https://rp-audiobook-snowy.vercel.app/auth/callback` |
| | `https://rp-audiobook.vercel.app/auth/callback` (falls Alias) |
| | `http://localhost:3000/auth/callback` (Dev) |

### 2. Registrierung abschalten

**Authentication → Providers → Email**

- Email provider: **ON**
- **Confirm email**: optional AUS (schneller für Beta-Gäste nach Invite)
- **Authentication → Settings** (oder „Sign In / Providers“ je nach UI-Version):
  - **Allow new users to sign up** → **OFF** / deaktivieren

Damit funktioniert nur noch:

- Login mit Passwort (bestehende User)
- **Invite** über das Dashboard (neue Gäste)

### 3. Anonym deaktivieren (Prod)

**Authentication → Providers → Anonymous** → **OFF**

Sonst kann jeder ohne Einladung reinkommen.

### 4. Gäste einladen

**Authentication → Users → Invite user**

- E-Mail des Beta-Gasts eintragen
- Supabase schickt Invite-Link → Gast setzt Passwort → kann sich danach normal anmelden

Alternativ: User manuell anlegen (Add user) mit temporärem Passwort.

### 5. SMTP (empfohlen für Beta)

Free-Tier: wenige Auth-Mails pro Stunde. Für mehr Gäste:

**Project Settings → Authentication → SMTP** → Resend / SendGrid / eigener SMTP.

### 6. Optional: E-Mail bestätigen

Wenn **Confirm email** AN ist, muss jeder Invite die Mail bestätigen. Für kleine Beta-Gruppe oft AUS lassen.

---

## App / Vercel

| Variable | Prod | Dev |
|----------|------|-----|
| `NEXT_PUBLIC_BETA_INVITE_ONLY` | `1` | leer oder `0` |

Wenn `1` (oder in Production standardmäßig):

- Kein Button „Account erstellen“
- Kein anonymer Dev-Login
- Hinweis: „Beta — Zugang nur mit Einladung“

Nach dem ersten Login: in Supabase `user_profiles.tier = 'beta'` für eingeladene Tester setzen (siehe [BETA-BILLING.md](./BETA-BILLING.md)).

## Checkliste nach dem Setup

- [ ] Sign-up in Supabase **aus**
- [ ] Anonymous **aus**
- [ ] Redirect URLs für Prod eingetragen
- [ ] Test-Invite an dich selbst → Link → Passwort → Login OK
- [ ] Öffentliches Registrieren in der App nicht sichtbar
- [ ] Fremde E-Mail ohne Invite kann **keinen** Account anlegen

## Fehlerbilder

| Symptom | Lösung |
|---------|--------|
| „Signups not allowed“ beim Registrieren | Erwartet — Gäste nur per Invite |
| Invite-Link landet auf localhost | Site URL / Redirect URLs in Supabase prüfen |
| „Email rate limit“ | Warten oder SMTP konfigurieren |

Siehe auch: [AUTH.md](./AUTH.md), [DEPLOY.md](./DEPLOY.md)
