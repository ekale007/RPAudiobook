# HörbuchKI — Roadmap & offene Punkte

Stand: nach Phase E (Chat edit / rewind / reroll / continue).  
Ziel: WryTour-ähnliches RPG im Browser, PWA am Handy, Kokoro lokal am PC.

---

## Erledigt

| Phase | Inhalt |
|-------|--------|
| A | RPG-Chat, Lore, Seed „When Dawn Breaks“, Supabase |
| B | TTS (edge-tts, ElevenLabs, Kokoro) |
| C | Story-Hub, Kapitel, Export, Mobile LAN |
| D | Gruppenchat, Multi-Voice (Kokoro pro Figur) |
| E | Nachricht bearbeiten, Rewind, Reroll, Continue |
| Auth | Passwort, Reset, kein Magic Link |
| Ops | `HF_TOKEN`, `npm run start:local`, package.json BOM-Fix |

---

## Nächste Schritte (empfohlene Reihenfolge)

### 1. Mobile-Härtung (du testest gerade)

- [ ] Login Passwort am Handy (`http://<PC-IP>:3000`)
- [ ] Chat senden / streamen
- [ ] **Listen** nur wenn PC: `npm run tts:kokoro` + `npm run dev` laufen
- [ ] Settings: OpenRouter-Key pro Browser (localStorage)
- [ ] PWA „Zum Home-Bildschirm“

**Bekannte Lücke:** TTS läuft nicht auf dem Handy — nur Proxy über PC. Optional später: Cloud-TTS oder Handy im WLAN mit PC-Server (bereits so gedacht).

### 2. Stabilität & Daten

- [ ] Supabase-Migrationen 001–003 auf Prod-Projekt angewendet?
- [ ] `turns.speaker_slug` vorhanden (003) — Gruppenchat sonst ohne Sprecher-Spalte
- [x] Rolling summary: Voll-Rebuild, Sync nach Rewind/Reroll/Edit, Story-State-Block
- [x] Keine doppelte Kapitel-Memory (Band ODER Prior-Summaries)
- [ ] Duplikat-Import verhindern (zweites „When Dawn Breaks“)

### 3. UX-Verbesserungen Chat

- [ ] Rewind/Reroll: eigene Bestätigungstexte (Reroll ≠ Rewind)
- [x] „Schlag was vor“: KI schlägt 3 Story-Richtungen mit Intro vor, Spieler wählt
- [ ] Story-Beat-Vorschläge im Gruppenchat + am Handy testen
- [ ] Streaming-Abbruch (Stop-Button)
- [ ] Gruppenchat: Reroll ganze „Runde“ visuell klarer

### 4. In-App-Editoren (größerer Brocken)

- [ ] Lorebook-Einträge in der App bearbeiten
- [ ] Character Cards anpassen
- [ ] Voice-Map UI bereits unter `/story/[id]/voices` — evtl. Vorschau pro Figur

### 5. Story-Struktur

- [ ] Branching / alternative Timelines
- [ ] Band-Übersicht über mehrere Volumes
- [ ] Export/Import ganzer Story-Stände

### 6. TTS / Audio

- [x] **Kokoro** — produktiv (`npm run tts:kokoro`, Figuren-Stimmen, Autoplay)
- [ ] Qwen3-TTS — **zurückgestellt**; Masterplan: [`docs/QWEN-MASTERPLAN.md`](./QWEN-MASTERPLAN.md) (Performance, Voice Design, Clone pro Figur)
- [ ] WAV-Segmente sauber concat (Multi-Chunk) — bei langen Texten prüfen
- [ ] ElevenLabs Multi-Voice (falls gewünscht)

### 7. Produktion

- [ ] Deploy (Vercel o.ä.) + Supabase Prod-URLs
- [ ] Keine Secrets im Repo (`.env.local` nur lokal)
- [ ] Optional: Custom SMTP Supabase (weniger Rate-Limits)

---

## Kritische / bekannte Stellen

| Thema | Risiko | Workaround |
|-------|--------|------------|
| **TTS nur auf PC** | Handy ohne Ton wenn Kokoro aus | PC-Server laufen lassen; gleiches WLAN |
| **Rewind/Reroll** | `rolling_summary` passt nicht mehr zum Text | Kapitel schließen / Summary manuell ignorieren; Fix: Summary nach Truncate neu generieren |
| **package.json BOM** | `npm run dev` bricht | `predev`/`prebuild` strippt BOM; Editor auf UTF-8 ohne BOM speichern |
| **HF_TOKEN** | Kokoro-Download rate-limit | `HF_TOKEN` in `.env.local` |
| **Gruppenchat Parsing** | Modell vergisst `<<speaker:…>>` oder mischt „You…“ unter Figuren | Strengerer Prompt + Auto-Fix (`normalizeSpeakerBlocks`); bei anhaltenden Fehlern Narrator-Modus |
| **TTS ohne Sprechername** | Kokoro liest nur Fließtext | `prepareTextForTts`: „Naya Vellen: …“ vor Figur-Dialog |
| **Supabase RLS** | Nur eigene Stories | Korrekt so; Anonymous-User = eigene Daten |
| **Archivierte Kapitel** | Read-only, keine Edit-Buttons | By design |
| **Git** | Repo war lokal ohne Git | Erstes Commit angelegt (siehe unten) |

---

## Mobile-Test-Checkliste (kurz)

```
PC:  npm run start:local   (oder tts:kokoro + dev getrennt)
App: http://<PC-IP>:3000
```

1. Login → Story → Continue playing  
2. Nachricht senden, Antwort lesen  
3. Edit / Rewind / Reroll an einer Antwort  
4. Continue — narrator goes on  
5. Story-Hub → Group chat + Character voices  
6. Settings OpenRouter (falls noch nicht am Handy gesetzt)  

Notizen unten eintragen:

- [ ] …

---

## Verzeichnis / Skripte

| Pfad | Zweck |
|------|--------|
| `src/` | Next.js App |
| `scripts/` | Kokoro, edge-tts, install, env loader |
| `supabase/migrations/` | SQL 001–003 |
| `docs/` | AUTH, MOBILE, KOKORO, ROADMAP |
| `src/data/seed/wrytour/` | Bundled Seed (kein HTTP) |

Nicht versionieren: `node_modules/`, `.venv-*`, `.env.local`, `.next/`
