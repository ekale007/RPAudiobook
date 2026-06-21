# RP Audiobook

Interactive RPG-style stories in the browser with optional text-to-speech narration.

**License:** [AGPL-3.0-or-later](LICENSE) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Modes

| Mode | Setup | Data |
|------|--------|------|
| **Local-first** (OSS default) | No Supabase — `npm run start:local` | IndexedDB on your machine |
| **SaaS** (optional self-host) | Supabase + server API keys in env | Cloud sync, wallet, admin |

See [docs/LOCAL-FIRST.md](docs/LOCAL-FIRST.md) and [docs/DEPLOYMENT-MODES.md](docs/DEPLOYMENT-MODES.md).

## Quick start (local-first)

1. `npm install`
2. Copy `.env.example` → `.env.local` (optional; omit Supabase vars for local mode)
3. **Windows:** `npm run start:local` — starts Kokoro TTS + Next.js
4. **Or:** `npm run dev` → http://localhost:3000
5. Settings → add your **OpenRouter** key (stored in browser only)
6. Create or import a story — no account required

Optional Kokoro install (GPU/offline TTS):

```powershell
.\scripts\install-kokoro.ps1
npm run tts:kokoro   # terminal 1
npm run dev          # terminal 2
```

Settings → **Local** → engine **kokoro** → Save. Add `HF_TOKEN=hf_...` to `.env.local` for reliable model download — [docs/KOKORO-QWEN.md](docs/KOKORO-QWEN.md).

**edge-tts (internet):** `pip install -r scripts/requirements-tts.txt` → `npm run tts:server`

## Quick start (SaaS / Supabase)

1. Supabase: run SQL migrations in `supabase/migrations/`
2. `.env.local` from `.env.example` with `NEXT_PUBLIC_SUPABASE_*`
3. Set legal env vars for public hosting: `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`, `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`, `NEXT_PUBLIC_SITE_URL`
4. `npm install` && `npm run dev`
5. Sign in → cloud story sync

Auth: [docs/AUTH.md](docs/AUTH.md)

## Features

- Character cards & lore import/export, keyword lore injection
- Story → Band → Chapter → Turns with AI summaries
- Multi-voice cast, chat edit / rewind / reroll
- TTS: Kokoro (local), edge-tts, Fish Audio, ElevenLabs, OpenRouter TTS (BYOK in local mode)
- Soundscape (ambience / SFX / music) client-side

## Docs

| Doc | Topic |
|-----|--------|
| [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md) | OSS release checklist |
| [docs/LOCAL-FIRST.md](docs/LOCAL-FIRST.md) | Local mode architecture |
| [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md) | Status & roadmap |
| [docs/README.md](docs/README.md) | Full index |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | App (LAN `-H 0.0.0.0`) |
| `npm run start:local` | Kokoro + Next (Windows, local-first) |
| `npm run tts:kokoro` | Kokoro-82M (port 5124) |
| `npm run tts:server` | edge-tts (port 5123) |
| `npm run build` | Production build |

## Open source

This repository is meant for **running locally on your own machine**. Public multi-user hosting requires your own legal pages, API keys, and compliance work — see [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md).

Do not commit `.env.local` or personal contact details.
