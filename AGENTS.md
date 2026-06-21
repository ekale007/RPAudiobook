# RP Audiobook — Agent Index

Interaktives Story-RPG im Browser mit optionaler Sprachausgabe (TTS). Nutzer steuern die Handlung per Chat; der Erzähler antwortet per LLM und kann vorgelesen werden.

**Prod:** https://rp-audiobook.vercel.app · **Repo:** `d:\HörbuchKI` (früher HörbuchKI)

**Wissensbasis:** [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) · **Doc-Index:** [`docs/README.md`](docs/README.md)

---

## Stack

| Layer | Tech |
|-------|------|
| App | Next.js 15 App Router, React 19, TypeScript, Tailwind |
| Data | Supabase Auth, Postgres, Storage |
| LLM | OpenRouter → `/api/llm/chat` |
| TTS (Prod) | Fish S2-Pro (Beta-Standard), ElevenLabs, OpenRouter TTS |
| TTS (lokal) | Kokoro, edge-tts, Qwen/OmniVoice (Experimente) |
| Billing | Stripe Wallet, Tier free/beta/pro |
| Deploy | Vercel |

---

## Architektur (Kern-Loop)

```
Story → Band → Chapter → Turns (user/assistant)
                              ↓
                    LLM generateReply (OpenRouter)
                              ↓
                    MessageAudioPlayer + TtsAutoplayQueue
                              ↓
              getNarratorAudio → Fish/EL/local → MP3 blob
                              ↓
         optional cloud storage (turn audio) + client soundscape (SFX/music)
```

---

## Seiten (App Router)

| Route | Zweck |
|-------|--------|
| `/` | Start, Bibliothek |
| `/login`, `/signup` | Auth (Passwort, getrennte Seiten) |
| `/account` | Profil, Limits, Wallet |
| `/settings` | LLM/TTS-Einstellungen |
| `/admin` | Beta-Admin (User, Billing, Provider-Pricing) |
| `/story/new` | Neue Story |
| `/story/import` | EPUB/Seed-Import |
| `/story/[id]` | Story-Hub |
| `/story/[id]/chat` | **Haupt-Chat** (`ChatView`) |
| `/story/[id]/chapter` | Kapitel-Übersicht |
| `/story/[id]/cast` | Cast |
| `/story/[id]/voices` | Stimmen pro Figur |
| `/story/[id]/cards` | Lore/Cards |
| `/story/[id]/memory` | Story-Memory |
| `/story/[id]/world` | Welt-Settings |
| `/story/[id]/export` | Kapitel-Audio-Export |
| `/story/[id]/pronunciation` | Aussprache-Hints |
| `/legal/*` | Impressum, Datenschutz, AGB |
| `/dev/image-generator` | Verweis auf lokales `image-studio/` |
| `/dev/qwen-voices` | Qwen-Stimmen-Dev |

---

## API-Routes

| Route | Zweck |
|-------|--------|
| `/api/llm/chat` | Chat-Completion (Streaming) |
| `/api/llm/models` | Modell-Katalog |
| `/api/llm/usage` | LLM-Verbrauch |
| `/api/tts/fish` | Fish S2-Pro Synthese |
| `/api/tts/fish/voices` | Fish-Stimmen |
| `/api/tts` | ElevenLabs Proxy |
| `/api/tts/voices` | EL-Stimmen |
| `/api/tts/openrouter` | OpenRouter TTS |
| `/api/tts/local` | Lokaler Kokoro/edge-tts Proxy |
| `/api/tts/qwen`, `/api/tts/qwen-cloud` | Qwen TTS |
| `/api/tts/store` | Turn-Audio in Supabase Storage |
| `/api/tts/quota` | TTS-Speicher-Quota |
| `/api/billing/checkout` | Stripe Checkout |
| `/api/billing/webhook` | Stripe Webhook |
| `/api/billing/config` | Billing-Konfiguration |
| `/api/account` | Account-Daten |
| `/api/auth/me` | Session-Check |
| `/api/usage/log`, `/api/usage/estimate` | Verbrauch |
| `/api/admin/*` | Admin (User, Usage, Billing-Settings, Wallet-Credit) |
| `/api/health` | Healthcheck |

**TTS-Fehlercodes:** `session_required` (401, nicht eingeloggt) · `fish_auth` (502, Fish-Key ungültig)

---

## `src/lib/` — Modul-Index

| Ordner | Inhalt |
|--------|--------|
| `auth/` | Beta-Auth, Redirects, Fehler |
| `audio/` | Soundscape, SFX, Kapitel-Export, Turn-Speicher |
| `cast/` | Cast-Kontext, AI-Hilfen |
| `chapter/` | Auto-Kapitel, Summaries, Finalize |
| `chat/` | Dialog, Speaker-Blöcke, Attribution, Generate |
| `db/` | Turns, Stories, Storage, Preferences |
| `i18n/` | DE/EN UI (`messages/de.ts`, `en.ts`) |
| `import/` | EPUB, Story-Seeds |
| `llm/` | OpenRouter Client, Streaming |
| `lore/` | Lorebook-Scanner |
| `memory/` | Story/Character Memory, Plot State |
| `prompt/` | System-Prompts, Storyteller-Script |
| `pwa/` | PWA Install-State |
| `server/` | Tier, Wallet, Stripe, Provider-Pricing, Rate-Limits |
| `storage/` | TTS-Cache, Settings, Playback-Prefs (localStorage) |
| `story/` | Bibliothek, Templates, Protagonist |
| `supabase/` | Client, Admin, authFetch |
| `tts/` | **TTS-Kern** — siehe unten |
| `types.ts` | Shared Types |
| `brand.ts` | RP Audiobook Branding |

### `src/lib/tts/` (wichtig)

| Datei | Rolle |
|-------|--------|
| `narratorTts.ts` | Segmente, Multi-Voice, Fish-Chunking, Cache-Key |
| `MessageAudioPlayer.tsx` (Component) | UI + Synthese + Wiedergabe |
| `ttsAutoplayQueue.ts` | Serial Queue, Drive-Mode, Prewarm |
| `sharedTtsHtmlAudio.ts` | **iOS:** ein `<audio>` für alle Clips |
| `audioUnlock.ts` | Silent keepalive, `startAudioSession`, „Nur lesen“ |
| `mobileAudioPlayback.ts` | `preferHtmlMediaPlayback()` → iOS HTML-Audio |
| `playAssistantTurnAudio.ts` | Play ohne UI-Mount (Drive-Helfer) |
| `fishAudioDelivery.ts` | Fish-Emotion-Tags, Delivery |
| `ttsMediaSession.ts` | Lock-Screen / Media Session API |

**iOS TTS-Autoplay (Stand Juni 2026):** Ein Shared-Audio-Element; `prepare()` lädt nur Blobs (kein Bind während Prewarm); Queue pausiert statt stoppt; Keepalive pausiert während echtem TTS.

---

## `src/components/` — UI-Kern

| Component | Rolle |
|-----------|--------|
| `ChatView.tsx` | Chat, LLM, Drive-Mode (30 min), TTS-Queue |
| `MessageAudioPlayer.tsx` | ▶ pro Turn, Cloud-Cache, Multi-Voice |
| `ChatTurnBubble.tsx` | Turn-Darstellung |
| `TtsAutoplayToggle.tsx` | TTS-Auto an/aus |
| `TtsReadOnlyToggle.tsx` | „Nur lesen“ (iOS, kein Audio-Session-Konflikt mit Spotify) |
| `PwaInstallBanner.tsx` | PWA Install-Hinweis |
| `BetaOnboardingModal.tsx` | Beta-Onboarding |
| `LibraryTurntable` | Bibliothek (filtert nach UI-Locale DE/EN) |
| Voice-Picker | `FishAudioVoiceSelect`, `ElevenLabsVoiceSelect`, `KokoroVoicePicker`, … |

---

## Supabase Migrationen

`supabase/migrations/` — **001–017** (Prod alle anwenden):

| # | Thema |
|---|--------|
| 001 | Initial schema |
| 002–003 | Turn audio, speaker |
| 004–006 | Memory, covers, preferences |
| 007–008 | LLM usage, TTS quota |
| 009–011 | User profiles, usage events, email |
| 012–015 | Beta billing, TTS rates, tier limits, turn cost |
| 016 | Wallet + Stripe |
| **017** | **Provider pricing** (LLM/TTS Kosten + Markup pro Modell) |

---

## Datenflüsse

### Chat + neuer Assistant-Turn
1. `ChatView` → `generateReply` → `/api/llm/chat`
2. Turn in DB → `enqueueNewAssistantTts` wenn Autoplay
3. `TtsAutoplayQueue.drain()` → `MessageAudioPlayer.play()`

### TTS-Synthese
1. `getNarratorAudio` → Provider-Route (Fish/EL/local)
2. IndexedDB-Cache (`ttsAudioCache.ts`)
3. Optional: Cloud (`saveTurnAudio.ts`, `audioStoragePath` auf Turn)
4. Script-Blöcke: `scriptBlocksNeedMultiVoice`, Cast-Zitate = Charakter-Stimme

### Billing
1. `providerPricing.ts` + Admin-Tabellen (Migration 017)
2. `usageEvents.ts` loggt Verbrauch
3. Wallet via Stripe (`wallet.ts`, `/api/billing/*`)

---

## Konventionen

- Deutsche UI für Endnutzer; Code/Kommentare oft Englisch
- **Keine Git-Commits** ohne explizite Nutzer-Anfrage
- Minimale Diffs; bestehende Patterns in `src/lib/` wiederverwenden
- `npm run build` vor Release-Claims
- Image Studio: `image-studio/` — **nicht** Vercel-deployed
- OmniVoice/Qwen lokal: Experimente, nicht Beta-Scope

---

## Befehle

| Befehl | Zweck |
|--------|--------|
| `npm run dev` | Dev-Server (LAN `0.0.0.0:3000`) |
| `npm run build` | Release-Check |
| `npm run start:local` | Kokoro + Next (Windows) |
| `npm run tts:kokoro` | Lokaler Multi-Voice-Server |
| `npm run covers:missing` | Fehlende Bibliotheks-Cover |
| `npm run image-studio` | SDXL-GUI (separates Projekt) |
| `npm run agentmemory:seed` | Agentmemory bootstrap |

---

## Offene Schritte (P0)

Siehe [`docs/ROADMAP.md`](docs/ROADMAP.md):

1. Migration **017** auf Prod
2. [`SMOKE-TEST.md`](docs/SMOKE-TEST.md) komplett
3. [`BETA-CONTENT-LEGAL.md`](docs/BETA-CONTENT-LEGAL.md) Bibliothek
4. Fish API-Key + `BETA_TIER_FREE_MODELS` auf Vercel
5. Invite-Workflow E2E

---

## Agentmemory

```powershell
npx @agentmemory/agentmemory   # oder ~\start-agentmemory.ps1
npm run agentmemory:seed
# Viewer: http://localhost:3113
```

---

## Codebase Memory (MCP)

Graph-Index für strukturelle Code-Analyse (Calls, Routes, Architecture).

**Projektname:** `D-RPAudiobook` · **Artifact:** `.codebase-memory/graph.db.zst` (team-shareable)

```powershell
# Neu indexieren (Windows: Junction D:\RPAudiobook → Repo empfohlen)
powershell -File scripts/index-cbm.ps1

# Status / Suche (CLI)
codebase-memory-mcp cli list_projects
codebase-memory-mcp cli index_status '{\"project\":\"D-RPAudiobook\"}'
codebase-memory-mcp cli get_architecture '{\"project\":\"D-RPAudiobook\",\"aspects\":[\"all\"]}'
codebase-memory-mcp cli search_graph '{\"project\":\"D-RPAudiobook\",\"name_pattern\":\".*Tts.*\",\"label\":\"Function\"}'
```

MCP-Tools in Cursor: `search_graph`, `trace_path`, `get_code_snippet`, `detect_changes`, `get_architecture` — immer `project: "D-RPAudiobook"` setzen.

---

## Lokal / Experimentell (nicht Prod)

| Pfad | Zweck |
|------|--------|
| `image-studio/` | SDXL Cover-Studio (Port 5125) |
| `samples/omnivoice/` | OmniVoice Probe-WAVs |
| `scripts/install-omnivoice.ps1` | OmniVoice-Setup |
| `d:\LokalAI` | Separates Repo (8765/8766) — nicht HörbuchKI |

→ [`docs/EXPERIMENTAL-LOCAL.md`](docs/EXPERIMENTAL-LOCAL.md)
