# HörbuchKI

Interactive story roleplay (WryTour / SillyTavern-style) in the browser, with optional narrator audio and Supabase cloud saves.

## Features

| Phase | Status |
|-------|--------|
| A — RPG chat, lore, import When Dawn Breaks | Done |
| B — Narrator TTS (local edge-tts / ElevenLabs) | Done |
| C — Story hub, chapters, export, mobile | Done |
| D — Multi-voice + group chat | Done |
| E — Chat edit, rewind, reroll, continue | Done |

- **Cards & lore:** WryTour-compatible JSON, keyword lore injection
- **Structure:** Story → Band → Chapter → Turns + AI summaries
- **Keys:** OpenRouter + TTS stay in **browser localStorage**
- **Cloud:** Supabase for stories only

## Quick start

1. Supabase: run SQL migrations `001`–`003` in `supabase/migrations/`
2. `.env.local` from `.env.example`
3. `npm install`
4. `npm run dev` → http://localhost:3000 (phone: `http://<PC-IP>:3000`)
5. Settings → OpenRouter key
6. Sign in (**Password** tab — avoids Supabase email rate limits) → Import **When Dawn Breaks**

Auth help: [docs/AUTH.md](docs/AUTH.md)

### Narrator audio on PC

**Kokoro (recommended, GPU, offline):**

```powershell
.\scripts\install-kokoro.ps1
.\.venv-kokoro\Scripts\Activate.ps1
npm run tts:kokoro   # terminal 1
npm run dev          # terminal 2
```

Settings → **Local** → Engine **kokoro** → Voice `af_bella` or `af_heart` → Save.

Add `HF_TOKEN=hf_...` to `.env.local` (Hugging Face read token) so Kokoro can download the model reliably — see [docs/KOKORO-QWEN.md](docs/KOKORO-QWEN.md).

**edge-tts (quick, needs internet):** `pip install -r scripts/requirements-tts.txt` → `npm run tts:server`

## Docs

- [docs/ROADMAP.md](docs/ROADMAP.md) — nächste Schritte, kritische Punkte, Mobile-Checkliste
- [docs/LOCAL-TTS.md](docs/LOCAL-TTS.md) — edge-tts, Piper offline
- [docs/KOKORO-QWEN.md](docs/KOKORO-QWEN.md) — GPU engines (1080 Ti)
- [docs/MOBILE.md](docs/MOBILE.md) — phone testing
- [docs/AUTH.md](docs/AUTH.md) — login & password reset

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | App (LAN-friendly `-H 0.0.0.0`) |
| `npm run tts:server` | edge-tts (port 5123, internet) |
| `npm run tts:kokoro` | Kokoro-82M (port 5124, GPU/CPU) |
| `npm run seed:sync -- "D:\…\WryTour"` | Refresh bundled seed JSON |
| `npm run start:local` | Kokoro + Next in zwei Fenstern (Windows) |

## Navigation

- **Home** → story list
- **Story hub** `/story/[id]` → chapters, cast, export
- **Chat** → play; **▶ Listen** on narrator replies
- **Close chapter** → summary + new chapter
