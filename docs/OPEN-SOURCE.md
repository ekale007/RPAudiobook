# Open Source — Plan & Checkliste

**Ziel:** Repo auf GitHub **öffentlich** — primär **lokal ausführbar** ohne Supabase/Vercel-Accounts (Ollama, lokales TTS, optional OpenRouter/Fish/EL/fal).  
**Optional:** Eigener gehosteter SaaS mit Supabase — getrennte Env, nicht Ziel der OSS-Nutzer.

**Technischer Plan Local-First:** [`LOCAL-FIRST.md`](./LOCAL-FIRST.md)

Kein Ersatz für juristische Beratung (Lizenz, AGB, Bibliothek-Inhalte).

---

## Release-Checkliste (Stand: Juni 2026)

### Phase A — Repo public

| Task | Status |
|------|--------|
| **LICENSE** (AGPL-3.0-or-later) | [x] `LICENSE` |
| **SECURITY.md** | [x] SSRF-Hinweis `/api/tts/local`, Reporting |
| **CONTRIBUTING.md** | [x] |
| Persönliche Legal-Defaults neutral | [x] `siteLegal.ts`, `.env.example` |
| Keine Secrets / `.env.local` im Repo | [x] `.gitignore`, Audit |
| Content-Audit Bibliothek | [x] siehe [BETA-CONTENT-LEGAL.md](./BETA-CONTENT-LEGAL.md) |
| README: Local vs SaaS | [x] |
| `package.json` `"license": "AGPL-3.0-or-later"` | [x] |

### Phase L — Local-First

| Stufe | Status |
|-------|--------|
| **L1** IndexedDB, kein Login ohne Supabase | [x] |
| **L2** Ollama-Provider | [ ] geplant |
| **L3** TTS-Audio lokal (kein Supabase Storage) | [ ] teilweise |
| **L4** `start:local-full`, Docs | [ ] teilweise |

### Vor `git push` + Public

- [ ] GitHub Repo auf **public** stellen
- [ ] Vercel/Supabase Env **nur** in Hosting-Dashboard (nicht im Repo)
- [ ] `NEXT_PUBLIC_LEGAL_*` auf Produktion setzen (Impressum)
- [ ] GitHub Security Advisories aktivieren

---

## Drei Betriebsmodi

| Modus | Wer | Daten | LLM | TTS |
|-------|-----|-------|-----|-----|
| **Local-First** (OSS-Kern) | Lokal / Desktop | IndexedDB | OpenRouter BYOK, Ollama (geplant) | Kokoro, edge-tts, BYOK |
| **Self-Host Server** (optional) | Eigener Server | Supabase | Server-Proxy | Server-Proxy |
| **Hosted SaaS** (optional) | Betreiber | Supabase | Server-Keys | Server-Keys + Wallet |

---

## Lizenz

**AGPL-3.0-or-later** — Forks dürfen lokal laufen; Netzwerk-SaaS mit geändertem Code muss Quelltext bereitstellen (AGPL §13). Deine eigene gehostete Instanz bleibt legal, solange du die Lizenz einhältst.

| Lizenz | Local Fork | Eigener Vercel-SaaS |
|--------|------------|---------------------|
| **AGPL-3.0** | Frei | OK (du betreibst Instanz) |
| MIT | Frei, weniger Schutz vor Closed SaaS | OK |

---

## Verweise

| Doc | Thema |
|-----|--------|
| [LOCAL-FIRST.md](./LOCAL-FIRST.md) | Lokal ohne Cloud |
| [SECURITY.md](../SECURITY.md) | Sicherheit & Reporting |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Beiträge |
| [BETA-CONTENT-LEGAL.md](./BETA-CONTENT-LEGAL.md) | Bibliothek & Urheber |
| [DEPLOY.md](./DEPLOY.md) | Vercel SaaS |
| [PROJECT-STATUS.md](./PROJECT-STATUS.md) | Gesamtstatus |
