# RP Audiobook — Roadmap

> **Vollständiger Stand, Erkenntnisse und P0–P2-Checklisten:** [`PROJECT-STATUS.md`](./PROJECT-STATUS.md)

---

## Erledigt (Kurz)

Phasen A–E, Auth, Billing/Wallet, Fish Audiobook-Soundscape, bilingual DE/EN-Bibliothek (20 Twins), Login/Signup getrennt, Mixed-Speaker-Dialog, RP-Branding, Rechtsseiten + Beta-Onboarding.

---

## Nächste Schritte (Reihenfolge)

### 1. Beta-Go (P0)

- [ ] [`SMOKE-TEST.md`](./SMOKE-TEST.md) Prod komplett
- [ ] Supabase Migrationen 001–017 auf Prod
- [ ] [`BETA-CONTENT-LEGAL.md`](./BETA-CONTENT-LEGAL.md) Bibliothek
- [ ] Fish API-Key + `BETA_TIER_FREE_MODELS` auf Vercel

### 2. Closed Beta (P1)

- [ ] 5–15 Tester, Invite + Tier `beta`
- [ ] Onboarding + Tooltips
- [ ] Feedback-Kanal, Known Issues in `/account`
- [ ] Echte Musik-Loops statt Placeholder in `sfxCatalog`

### 3. UX & Stabilität

- [ ] Mobile: Login, Chat, Fish TTS iOS PWA *(TTS-Auto/Drive-Mode: getestet Mai 2026)*
- [ ] Duplikat-Import verhindern
- [ ] Stop-Button beim Streaming
- [ ] Admin: Modell-Whitelist UI

### 4. Größere Brocken (P2+)

- [ ] **[LOCAL-FIRST.md](./LOCAL-FIRST.md)** — komplett lokal (IndexedDB, Ollama, lokales TTS)
- [x] **[OPEN-SOURCE.md](./OPEN-SOURCE.md)** — AGPL-3.0, SECURITY.md, local-first OSS checklist
- [ ] Lorebook-/Card-Editor in App
- [ ] Branching / Timelines
- [ ] Fish offline-SFX → Storage
- [ ] OmniVoice/Qwen Produktionspfad (optional)

---

## Kritische Stellen

| Thema | Workaround |
|-------|------------|
| Fish Key abgelaufen | 502 + `fish_auth` — Key in Vercel erneuern |
| iOS + Spotify | „Nur lesen“ in Chat |
| Supabase Mail-Limit | Passwort-Login |
| LokalAI CORS 8766 | Separates Repo — Orchestrator starten, siehe [`EXPERIMENTAL-LOCAL.md`](./EXPERIMENTAL-LOCAL.md) |

---

## Verzeichnis

| Pfad | Zweck |
|------|--------|
| `src/` | Next.js App |
| `docs/PROJECT-STATUS.md` | Wissensbasis |
| `image-studio/` | Lokales SDXL (nicht Vercel) |
| `samples/omnivoice/` | TTS-Experimente |
