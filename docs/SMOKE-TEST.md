# Smoke-Test — Kurz erklärt

Ein **Smoke-Test** ist kein automatischer Testlauf, sondern eine **schnelle manuelle Kontrolle nach jedem Deploy**: Funktioniert die App überhaupt noch? Raucht etwas?

Name von „Rauch aus dem Schornstein = Maschine läuft“ — hier: **5–10 Minuten durchklicken**, bevor du Beta-Tester einlädst.

## Wann?

- Nach jedem Vercel-Deploy
- Nach Supabase-Migrationsänderungen
- Nach größeren UI-Updates (Bibliothek, Chat, TTS)

## Checkliste (Prod: https://rp-audiobook.vercel.app)

### Auth & Basis

- [ ] Startseite lädt ohne Fehler
- [ ] Login / Passwort-Reset funktioniert
- [ ] Ausloggen → wieder einloggen

### Server-Features (Beta)

- [ ] Eingeloggt: Chat-Antwort kommt (LLM)
- [ ] TTS abspielen (DE-Story)
- [ ] TTS abspielen (EN-Story)
- [ ] Settings → erlaubte Modelle sichtbar, Verbrauchsanzeige

### TTS & Audio (Beta)

- [ ] Settings → ElevenLabs → optional **Eleven v3 (Test)**
- [ ] Cast → **Szenen-Stil** an → Chat ▶ (dynamische Stimmung)
- [ ] SFX: Plot mit „Regen“ / `<<sfx:rain>>` → leiser Loop unter TTS
- [ ] Optional: Qwen Cloud wenn `DASHSCOPE_API_KEY` auf Vercel gesetzt

### Bibliothek

- [ ] Drehteller: wischen / Pfeile
- [ ] Import → neue Story öffnet sich
- [ ] **Duplikat:** gleiche Vorlage nochmal → Hinweis, keine doppelte Story

### Chat (Desktop + Handy)

- [ ] Nachricht senden, Stream sichtbar
- [ ] **Stop** bricht Generierung ab
- [ ] „Schlag was vor“ → Vorschläge auf **Deutsch** (DE-Story)
- [ ] Autoplay TTS (Mobile, wenn aktiviert)

### Story bearbeiten

- [ ] Story-Hub → **Welt & Lore** speichern
- [ ] Story-Hub → **Charakterkarten** speichern
- [ ] Gedächtnis / Cast / Voices noch erreichbar

### Bekannte Grenzen (kein Fail)

- Rate-Limits bei viel Nutzung → Fehlermeldung, kein Crash
- Kokoro/Qwen nur lokal — auf Vercel nur ElevenLabs-Server-TTS

## Notizen

| Datum | Tester | Auffälligkeiten |
|-------|--------|-----------------|
|       |        |                 |

Siehe auch: [DEPLOY.md](./DEPLOY.md)
