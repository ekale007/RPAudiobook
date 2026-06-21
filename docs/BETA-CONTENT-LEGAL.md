# Beta — Inhalte & Copyright

Checkliste vor öffentlicher Beta und OSS-Release. Kein Ersatz für juristische Beratung.

**OSS-Stand (Juni 2026):** Bundled Bibliotheks-Vorlagen sind **Projekt-Originale** (RP Audiobook Library), keine erkennbaren Fremd-IP-Franchises. Cover siehe `public/library-covers/README.md`.

---

## 1. Grundsätze

| Regel | Umsetzung |
|-------|-----------|
| Standard-Bibliothek = **eigene Werke** | `creator: "RP Audiobook Library"`, `creator_notes` ohne fremde Marken |
| Nutzer-Stories | Nutzer haftet für Prompts/Uploads; in AGB festhalten |
| KI-Ausgabe | Hinweis: generiert, kann Fehler enthalten; nicht als professionelles Hörbuch verkaufen |
| Stimmen | Kein Cloning realer Personen ohne Einwilligung; Beta: nur Preset-/Server-Stimmen |
| Screenshots/Werbung | Nur eigene Vorlagen oder anonymisierte Beispiele |

---

## 2. Bibliotheks-Inventar

Alle Vorlagen unter `src/lib/story/libraryTemplates.ts` + `libraryTemplatesExtra.ts`.  
Seed-Daten: `src/data/seed/library/`.

| Vorlage (ID) | Locale | Urheber-Status | Cover | Aktion |
|--------------|--------|----------------|-------|--------|
| `when-dawn-breaks` | en | Eigen/Projekt | project | [x] |
| `crossroads-inn` | en | RP Audiobook Library | generated | [x] |
| `station-echo` | en | RP Audiobook Library | generated | [x] |
| `last-letter` | en | RP Audiobook Library | generated | [x] |
| `haunted-lake` | en | RP Audiobook Library | generated | [x] |
| `midnight-bakery` | en | RP Audiobook Library | generated | [x] |
| `iron-republic` | en | RP Audiobook Library | generated | [x] |
| `neon-witness` | en | RP Audiobook Library | generated | [x] |
| `desert-oath` | en | RP Audiobook Library | generated | [x] |
| `tide-line` | en | RP Audiobook Library | generated | [x] |
| `schatten-kaiser` | de | RP Audiobook Library | generated | [x] |
| `akademie-arkanum` | de | RP Audiobook Library | generated | [x] |
| `system-null` | de | RP Audiobook Library | generated | [x] |
| `blutmond-pakt` | de | RP Audiobook Library | generated | [x] |
| `zug-47` | de | RP Audiobook Library | generated | [x] |
| `second-life-protocol` | en | RP Audiobook Library | generated | [x] |
| `guild-last-light` | en | RP Audiobook Library | generated | [x] |
| `starlit-court` | en | RP Audiobook Library | generated | [x] |
| `hexbound-academy` | en | RP Audiobook Library | generated | [x] |
| `ghost-signal` | en | RP Audiobook Library | generated | [x] |

**Prüffragen pro Vorlage**

1. Enthält Texte Namen/Welten aus fremden Franchises?
2. Ist `first_mes` / Lore vollständig selbst geschrieben?
3. Cover (`/public/library-covers/`): Quelle? (SDXL/MJ/Hand — Lizenz dokumentieren)
4. Darf in Screenshots und Posts gezeigt werden?

---

## 3. Technische Formate

- Charakterkarten & Lore nutzen ein **eigenes JSON-Schema** (`StoryCharacterCard`, `StoryLorebook`) — kompatibel mit gängigen Card-Exporten, **ohne** Fremdmarke.
- Bundled Seed liegt unter `src/data/seed/library/`.
- Nutzer-Import eigener Cards: in AGB „nur Rechte, die du hast“.

---

## 4. Öffentliche Webseite

| Risiko | Maßnahme |
|--------|----------|
| Personenbezogene Daten (E-Mail, Stories) | Datenschutzerklärung, Supabase AV-Vertrag prüfen |
| US-Dienste (OpenRouter, ElevenLabs, Vercel) | in Datenschutz nennen, ggf. Standardvertragsklauseln |
| Minderjährige | Beta nur 16+ empfehlen (in AGB) |
| KI-Transparenz | „Antworten werden von KI-Modellen erzeugt“ |

---

## 5. Was Nutzer nicht tun dürfen (AGB-Kern)

- Geschützte Werke nachahmen und verbreiten
- Stimmen echter Personen ohne Zustimmung klonen
- Illegale Inhalte, Belästigung, Spam
- Automatisiertes Auslesen / API-Missbrauch

---

## 6. Vor Go-Live (SaaS)

- [x] Inventar-Tabelle für OSS-Bibliothek abgehakt
- [x] Keine Vorlage mit offensichtlichem Fanfic an fremden IP
- [x] Cover-Ordner: README mit Generierungs-Pipeline (`docs/COVER-PROMPTS.md` verlinken)
- [ ] AGB verlinkt in App-Footer und Invite-Mail (SaaS)

---

## 7. Bei Meldung „Urheberrechtsverletzung“

1. Story/User identifizieren (Admin / Supabase)
2. Inhalt sperren oder Account sperren
3. Vorlage aus Bibliothek entfernen, falls betroffen
4. Dokumentation im Repo aktualisieren
