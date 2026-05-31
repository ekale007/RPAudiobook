# Online-Deploy (Vercel + Supabase)

Checkliste für Beta-Deploy mit Server-LLM/TTS (ElevenLabs + OpenRouter).

## 1. Supabase (Prod)

1. Projekt anlegen oder Prod-Instanz nutzen
2. **SQL-Migrationen** der Reihe nach ausführen (`supabase/migrations/001` … `007`)
3. **Auth → URL configuration**
   - Site URL: `https://<deine-domain>`
   - Redirect URLs: `https://<deine-domain>/auth/callback`, `http://localhost:3000/auth/callback` (Dev)
4. **Storage**: Bucket für Story-Covers / Turn-Audio wie in Migrationen (falls genutzt)
5. RLS prüfen: User sieht nur eigene Stories, Characters, Usage

## 2. Vercel

1. Repo verbinden, Framework: **Next.js**
2. **Environment Variables** (Production):

| Variable | Pflicht | Hinweis |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | Anon key (öffentlich OK) |
| `NEXT_PUBLIC_SITE_URL` | ja | `https://<deine-domain>` für Magic Links |
| `NEXT_PUBLIC_SERVER_TTS` | ja | `1` |
| `NEXT_PUBLIC_SERVER_LLM` | ja | `1` |
| `ELEVENLABS_API_KEY` | ja | **Nur Server** — nie `NEXT_PUBLIC_` |
| `OPENROUTER_API_KEY` | ja | **Nur Server** |
| `OPENROUTER_MODEL` | nein | Admin-Default, muss in `BETA_LLM_MODELS` stehen |
| `BETA_LLM_MODELS` | nein | JSON — erlaubte User-Modelle + ¢/1k (siehe `.env.example`) |
| `BETA_LLM_PROMPT_CENTS_PER_1K` | nein | Fallback-Schätzung wenn Modell unbekannt |
| `BETA_LLM_COMPLETION_CENTS_PER_1K` | nein | Fallback-Schätzung wenn Modell unbekannt |
| `RATE_LIMIT_LLM_PER_HOUR` | nein | Beta: `200`–`500` |
| `RATE_LIMIT_TTS_PER_HOUR` | nein | Beta: `200`–`400` |
| `BETA_LLM_BUDGET_CENTS` | nein | Default `10000` (= 100 €) |

3. Deploy auslösen → Build muss grün sein (`npm run build` lokal vorher testen)

## 3. Sicherheit (Stand dieses Snapshots)

- API-Routen `/api/tts`, `/api/llm/*` → **Supabase Auth** (Cookie + Bearer)
- Server-Keys nur in Vercel Env, **nicht** im Client
- `xi-api-key` Header-Fallback nur in **Development** (`NODE_ENV !== production`)
- Rate Limits pro User (in-memory; bei mehreren Vercel-Instanzen Limits ungenau — für Beta OK)
- `.env.local` / Secrets sind in `.gitignore`

**Optional später:** Upstash Redis für Rate Limits; `/api/auth/me` in Prod entfernen oder absichern.

## 4. Smoke-Test nach Deploy

Siehe **[SMOKE-TEST.md](./SMOKE-TEST.md)** — kurze manuelle Checkliste (Login, Chat, TTS, Bibliothek, …).

Kurz:

- [ ] Login / Passwort-Reset funktioniert
- [ ] `GET /api/health` → `{ serverTts: true, serverLlm: true }`
- [ ] `GET /api/auth/me` eingeloggt → `{ ok: true }`
- [ ] DE-Story: Chat + TTS
- [ ] EN-Story: Chat + TTS
- [ ] Settings → Modell-Picker (nur erlaubte Modelle) + Beta LLM Verbrauch
- [ ] Story-Gedächtnis → Von KI (Plot-State)
- [ ] Mobile: gleiche Domain wie Login (kein localhost/127.0.0.1-Mix)

## 5. Bekannte Beta-Limits

- Rate Limit & LLM-Budget: **pro Server-Instanz** / Schätzung in Cent
- Memory-Sync: alle 2–4 Turns (LLM-Kosten)
- Kein lokaler Kokoro/Qwen auf Vercel nötig (Server-TTS)

Siehe auch: [BETA-ELEVENLABS.md](./BETA-ELEVENLABS.md)
