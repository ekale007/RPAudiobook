# Beta: Abrechnung, Free Tier & Account

Stand: Tier in DB, Limits, Account-UI, **Verbrauchsprotokoll**, **Admin-UI** (`/admin`). **Kein Stripe** in dieser Phase.

## Was bereits läuft


| Bereich              | Status                                            |
| -------------------- | ------------------------------------------------- |
| LLM-Kosten-Schätzung | `user_llm_usage` (Migration 007), ¢/1k pro Modell |
| Monatsbudget         | Bisher global via `BETA_LLM_BUDGET_CENTS`         |
| Stündliche Limits    | In-Memory `RATE_LIMIT_LLM/TTS_PER_HOUR`           |
| UI Verbrauch         | Settings → „Beta LLM — Verbrauch“                 |
| Auth Beta            | Invite-only (`BETA-AUTH.md`)                      |
| TTS Cloud            | 100 MP3/Account (`008`)                           |


## Neu (Migration 009)

Tabelle `user_profiles`:


| Feld         | Bedeutung                                 |
| ------------ | ----------------------------------------- |
| `tier`       | `free` | `beta` | `pro`                   |
| `*_override` | Optional Admin-Override für Budget/Limits |


**Neue User** → automatisch `tier = free`.  
**Beta-Tester** → in Supabase: `UPDATE user_profiles SET tier = 'beta' WHERE user_id = '…';`

### Tier-Limits (Defaults)


| Tier     | LLM/Monat      | LLM/h     | TTS/h     | Cloud-MP3 | Modelle                    |
| -------- | -------------- | --------- | --------- | --------- | -------------------------- |
| **free** | 5,00 €         | 40        | 80        | 25        | Nur günstige Flash-Modelle |
| **beta** | 100,00 € (env) | 200 (env) | 200 (env) | 100 (env) | Voller Katalog             |
| **pro**  | 200,00 €       | 500       | 400       | 200       | Voller Katalog             |


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

### LLM (OpenRouter) — so sauber wie die API es erlaubt


| Ebene                                 | Quelle                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| **Monatsbudget & Log (`cost_cents`)** | Primär OpenRouter `usage.cost` (USD) × `BETA_USD_TO_EUR_RATE` → EUR-Cent |
| **Fallback**                          | Token × `BETA_LLM_MODELS` (manuell gepflegte ¢/1k)                       |
| **Stream ohne `cost`**                | Nach Ende: `GET /api/v1/generation?id=…` (gleiche API-Key)               |
| **Anzeige Zusatz**                    | `provider_cost_usd` im Protokoll (Roh-USD von OpenRouter)                |


Das ist **keine Stripe-Rechnung**, aber dieselbe Zahl, die OpenRouter eurem Konto belastet (in USD, für Limits in EUR umgerechnet).

### TTS (ElevenLabs)


| Ebene      | Quelle                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Menge**  | Header `x-character-count` (echt)                                                                                                                |
| **Kosten** | [Eleven API-Preisliste](https://elevenlabs.io/pricing/api): **$0,05/1k** (Flash/Turbo), **$0,10/1k** (Multilingual v2/v3) × USD→EUR aus `/admin` |
| **Plan**   | Starter: **$5/mo, 30k credits** — kein USD pro Request in der API; Log spiegelt die öffentliche $/1k-Liste                                       |


Pflege in `/admin` → Abrechnungskurse (Migration `013` für USD-Spalten).

### Übriges

1. **Hard Stop** — 429 bei Monatsbudget oder Stundenlimit.
2. **Transparenz** — Account + Verbrauchsprotokoll.
3. **Admin** — `/admin` oder SQL für `tier`.

## Provider-APIs (OpenRouter & ElevenLabs)

### OpenRouter


| Quelle                                                  | Daten                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| Jede Chat-Antwort (`usage` im JSON / letztes SSE-Chunk) | `prompt_tokens`, `completion_tokens`, `**cost` (USD)**, Cache-Tokens |
| Response-`id`                                           | Generation-ID (`gen-…`)                                              |
| `GET /api/v1/generation?id={id}`                        | Exakte `total_cost`, Provider, Latenz (Audit, optional)              |


Gespeichert in `usage_events`: Katalog-¢ (Monatsbudget) + optional `provider_cost_usd` aus OpenRouter.

### ElevenLabs


| Quelle                                           | Daten                                             |
| ------------------------------------------------ | ------------------------------------------------- |
| Response-Header `x-character-count`              | Zeichen pro TTS-Request                           |
| Header `request-id`                              | Korrelation mit Eleven-Dashboard                  |
| `GET /v1/user/subscription`                      | Workspace-Kontingent (nicht pro Spieler)          |
| [pricing/api](https://elevenlabs.io/pricing/api) | $/1k Zeichen nach Modell-Tier (Flash vs Standard) |


TTS-Kosten: Zeichen/1000 × Modell-$/1k × USD→EUR. Fehlt `x-character-count` → Textlänge.

## UI & Env (neu)


| Seite      | Inhalt                                                                                 |
| ---------- | -------------------------------------------------------------------------------------- |
| `/account` | Tarif, Limits, LLM-Verbrauch, **Verbrauchsprotokoll**, Link zu Admin (wenn berechtigt) |
| `/admin`   | Nutzerliste, Tarif, **Kurse** (USD→EUR, TTS ¢/1k), Protokoll                           |



| Env                           | Zweck                                   |
| ----------------------------- | --------------------------------------- |
| `ADMIN_USER_IDS`              | Kommagetrennte Supabase-User-UUIDs      |
| `SUPABASE_SERVICE_ROLE_KEY`   | Nur Server/Vercel — Admin-Liste & Tarif |
| `BETA_TTS_CENTS_PER_1K_CHARS` | TTS-Kostenschätzung                     |


Migrationen: `010`–`012` (`beta_billing_settings` für Admin-Kurse).

Kurse in `/admin` pflegen; `BETA_USD_TO_EUR_RATE` / `BETA_TTS_CENTS_PER_1K_CHARS` nur Fallback ohne DB-Zeile.

### Später (Post-Beta)

- `user_tts_usage` (Zeichen/Requests pro Monat)
- Stripe / Paddle + `subscriptions`
- E-Mail bei 80 % / 100 % Budget
- Redis/Upstash für Rate-Limits (Multi-Instance Vercel)
- Export Verbrauch CSV für Tester

## Account Management


| Feature                 | Route / Ort                      |
| ----------------------- | -------------------------------- |
| Profil & Tier           | `/account`                       |
| Verbrauch               | `/account` + Settings            |
| Anfragen & Kosten (Log) | `/account` → Verbrauchsprotokoll |
| Admin                   | `/admin` (nach Env)              |
| Passwort                | `/auth/update-password`          |
| Logout                  | `/account`                       |
| E-Mail                  | Supabase Auth (read-only in UI)  |


Checkliste Beta-Tester:

1. Migrationen `009`–`011` auf Supabase
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

