# Beta: Abrechnung, Free Tier & Account

Stand: Plan + erste Implementierung (Tier in DB, Limits, Account-UI). **Kein Stripe** in dieser Phase.

## Was bereits läuft

| Bereich | Status |
|---------|--------|
| LLM-Kosten-Schätzung | `user_llm_usage` (Migration 007), ¢/1k pro Modell |
| Monatsbudget | Bisher global via `BETA_LLM_BUDGET_CENTS` |
| Stündliche Limits | In-Memory `RATE_LIMIT_LLM/TTS_PER_HOUR` |
| UI Verbrauch | Settings → „Beta LLM — Verbrauch“ |
| Auth Beta | Invite-only (`BETA-AUTH.md`) |
| TTS Cloud | 100 MP3/Account (`008`) |

## Neu (Migration 009)

Tabelle `user_profiles`:

| Feld | Bedeutung |
|------|-----------|
| `tier` | `free` \| `beta` \| `pro` |
| `*_override` | Optional Admin-Override für Budget/Limits |

**Neue User** → automatisch `tier = free`.  
**Beta-Tester** → in Supabase: `UPDATE user_profiles SET tier = 'beta' WHERE user_id = '…';`

### Tier-Limits (Defaults)

| Tier | LLM/Monat | LLM/h | TTS/h | Cloud-MP3 | Modelle |
|------|-----------|-------|-------|-----------|---------|
| **free** | 5,00 € | 40 | 80 | 25 | Nur günstige Flash-Modelle |
| **beta** | 100,00 € (env) | 200 (env) | 200 (env) | 100 (env) | Voller Katalog |
| **pro** | 200,00 € | 500 | 400 | 200 | Voller Katalog |

Env-Overrides: `BETA_TIER_FREE_LLM_BUDGET_CENTS`, `BETA_TIER_FREE_LLM_HOUR`, … (siehe `.env.example`).

## Free Tier & „kostenlose“ APIs

Für **free** nutzt die App weiterhin **euren Server-Key** (OpenRouter/ElevenLabs) — Nutzer zahlen nicht direkt, ihr kontrolliert Kosten über Limits.

**Günstige / quasi-kostenlose LLM-Optionen (OpenRouter):**

- `google/gemini-2.5-flash-lite` (Default im Free-Tier-Katalog)
- `deepseek/deepseek-v4-flash`
- `qwen/qwen3.5-flash-02-23`
- Optional OpenRouter-`:free`-Modelle in `BETA_TIER_FREE_MODELS` (JSON-Array)

**TTS in Beta:** ElevenLabs über Server — Free-Tier = niedrigeres Stundenlimit, kein BYOK nötig.

**Dev/Test ohne Cloud-Kosten:** Edge/Kokoro lokal (`LOCAL-TTS.md`) — nur wenn User eigene Keys/Local nutzt (nicht Server-Beta-Pfad).

## Saubere Abrechnung (Beta-realistisch)

1. **Schätzung, keine Rechnung** — `cost_cents` aus Token × Modellpreis (Admin-Katalog).
2. **Hard Stop** — 429 bei Monatsbudget oder Stundenlimit.
3. **Transparenz** — Account-Seite + Settings zeigen Tier, Verbrauch, Rest.
4. **Admin** — Supabase SQL / später kleines Admin-UI für `tier` + Overrides.

### Später (Post-Beta)

- [ ] `user_tts_usage` (Zeichen/Requests pro Monat)
- [ ] Stripe / Paddle + `subscriptions`
- [ ] E-Mail bei 80 % / 100 % Budget
- [ ] Redis/Upstash für Rate-Limits (Multi-Instance Vercel)
- [ ] Export Verbrauch CSV für Tester

## Account Management

| Feature | Route / Ort |
|---------|-------------|
| Profil & Tier | `/account` |
| Verbrauch | `/account` + Settings |
| Passwort | `/auth/update-password` |
| Logout | `/account` |
| E-Mail | Supabase Auth (read-only in UI) |

Checkliste Beta-Tester:

1. Migration `009` auf Supabase
2. Invite User → `tier = beta` setzen
3. Öffentliche Tester → `free` (Default)
4. `BETA_LLM_MODELS` mit realen ¢/1k pflegen
5. Monatlich: `user_llm_usage` in Supabase prüfen

## SQL-Snippets

```sql
-- Beta-Tester freischalten
update public.user_profiles
set tier = 'beta', updated_at = now()
where user_id = 'UUID-HIER';

-- Einmaliges höheres Budget
update public.user_profiles
set llm_budget_cents_override = 15000, tier = 'beta'
where user_id = 'UUID-HIER';
```
