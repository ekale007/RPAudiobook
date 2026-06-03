# Beta-Plan: ElevenLabs + Server-LLM

Ziel: 2–3 Tester, **DE/EN getrennt**, keine lokalen TTS-Server, Keys nur auf dem Server.

## Architektur

```
Browser → Next.js API Routes → ElevenLabs / OpenRouter
                ↓
         Supabase Auth (Rate limit pro User)
                ↓
         Supabase Storage (Audio-Cache pro Turn)
```

## Umgebungsvariablen (`.env.local` / Vercel)

| Variable | Pflicht Beta | Beschreibung |
|----------|--------------|--------------|
| `ELEVENLABS_API_KEY` | ja | Server-TTS |
| `OPENROUTER_API_KEY` | ja | Server-LLM |
| `OPENROUTER_MODEL` | nein | Default `anthropic/claude-sonnet-4` |
| `OPENROUTER_NARRATOR_MODEL` | nein | Optional für Chat |
| `NEXT_PUBLIC_SERVER_TTS=1` | ja | Client ohne EL-Key |
| `NEXT_PUBLIC_SERVER_LLM=1` | ja | Client ohne OR-Key |
| `RATE_LIMIT_LLM_PER_HOUR` | nein | Default 80 (Anfragen/Stunde/User) |
| `RATE_LIMIT_TTS_PER_HOUR` | nein | Default 200 |
| `BETA_LLM_BUDGET_CENTS` | nein | Monatsbudget pro User in Cent (Default 10000 = 100,00 €) |
| `BETA_LLM_MODELS` | nein | JSON-Array: erlaubte Modelle + ¢/1k Prompt/Antwort (User-Picker) |
| `BETA_LLM_PROMPT_CENTS_PER_1K` | nein | Fallback-Schätzung wenn Modell unbekannt |
| `BETA_LLM_COMPLETION_CENTS_PER_1K` | nein | Fallback-Schätzung wenn Modell unbekannt |

## LLM-Verbrauch (Beta)

- Migration `007_llm_usage.sql` auf Supabase anwenden
- User sehen unter **Settings → Beta LLM — Verbrauch**: Monatsbudget (€), Stunden-Limit, Token-Schätzung
- Jeder Chat + Memory-Sync (Plot, Rolling Summary, …) zählt als Anfrage
- Bei 429: stündliches Limit oder Monatsbudget — Fehlermeldung verweist auf Settings

**Tipp:** Memory-Sync alle 2–4 Turns + Kapitel-Zusammenfassungen verbrauchen LLM-Kontingent — `RATE_LIMIT_LLM_PER_HOUR=200` für aktive Tester erwägen.

## Sprach-Routing (kein Gemisch)

- `story.locale === "de"` → `eleven_multilingual_v2` + DE-Stimmen-Preset
- `story.locale === "en"` → gleiches Modell + EN-Stimmen-Preset
- Cast-Stimmen: pro Story in `settings.voiceMap` (Voices-Page)

## Phasen

### Phase 1 — Done in Codebase (dieser Stand)

- [x] `/api/tts` mit Server-Key + Auth + Rate limit
- [x] `/api/llm/chat` (stream) + `/api/llm/complete`
- [x] Client-Proxy wenn `NEXT_PUBLIC_SERVER_*=1`
- [x] ElevenLabs Default-Stimmen DE/EN
- [x] Voices-Page für ElevenLabs

### Phase 2 — Deploy (1–2 Tage)

- Siehe **[DEPLOY.md](./DEPLOY.md)** für Checkliste
- Vercel + Supabase Prod
- Env setzen, Migrationen 001–007
- 3 Test-Accounts
- Smoke: DE-Story + EN-Story, TTS + Chat

### Phase 3 — Härtung (2–3 Tage)

- Turn-Audio Cache invalidieren bei Engine-Wechsel
- Admin-Log Synth-Fehler
- Optional Upstash Redis für Rate limits (multi-instance)

### Phase 4 — Mehr Stimmen

- ElevenLabs Voice-Liste aus API cachen
- UI: Stimmen-Vorschau pro Locale

## Kosten (3 User, leicht)

**Aktueller Plan:** [Starter](https://elevenlabs.io/pricing) — **$5/mo**, **30.000 credits**/Monat (~30 min Standard-TTS), kommerzielle Nutzung, Instant Voice Cloning. Kein Pay-as-you-go-Overage auf Starter (Upgrade bei mehr Bedarf).

**API-Preise fürs Verbrauchsprotokoll** ([pricing/api](https://elevenlabs.io/pricing/api)):

| Modell-Tier | $ / 1k Zeichen | Typische Modelle in der App |
|-------------|----------------|----------------------------|
| Flash / Turbo | $0,05 | `eleven_flash_v2_5` |
| Multilingual v2/v3 | $0,10 | `eleven_multilingual_v2`, `eleven_v3` |

In `/admin` → Abrechnungskurse pflegen (USD→EUR + beide TTS-$/1k).

| Posten | ~/Monat |
|--------|---------|
| ElevenLabs | 5–25 € (Starter-Grundgebühr + Credits) |
| OpenRouter | 15–40 € |
| Vercel + Supabase | 0–25 € |

## Dev lokal

1. Keys in `.env.local` (siehe `.env.example`)
2. `NEXT_PUBLIC_SERVER_TTS=1` + `NEXT_PUBLIC_SERVER_LLM=1`
3. Settings → Provider **ElevenLabs**
4. Kein `npm run tts:kokoro` nötig
