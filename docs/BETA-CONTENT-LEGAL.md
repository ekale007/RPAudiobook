# Beta — Inhalte & Copyright

Checkliste vor öffentlicher Beta und Werbung. Kein Ersatz für juristische Beratung.

---

## 1. Grundsätze

| Regel | Umsetzung |
|-------|-----------|
| Standard-Bibliothek = **eigene Werke** | `creator: "HörbuchKI Library"`, `creator_notes` ohne fremde Marken |
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
| `when-dawn-breaks` | en | Eigen/Projekt — Texte HörbuchKI | prüfen | [x] `creator_notes` bereinigt |
| `crossroads-inn` | en | HörbuchKI Library | generated? | [ ] bestätigen |
| `station-echo` | en | HörbuchKI Library | | [ ] |
| `last-letter` | en | HörbuchKI Library | | [ ] |
| `haunted-lake` | en | HörbuchKI Library | | [ ] |
| `midnight-bakery` | en | HörbuchKI Library | | [ ] |
| `iron-republic` | en | HörbuchKI Library | | [ ] |
| `neon-witness` | en | HörbuchKI Library | | [ ] |
| `desert-oath` | en | HörbuchKI Library | | [ ] |
| `tide-line` | en | HörbuchKI Library | | [ ] |
| `schatten-kaiser` | de | HörbuchKI Library | | [ ] |
| `akademie-arkanum` | de | HörbuchKI Library | | [ ] |
| `system-null` | de | HörbuchKI Library | | [ ] |
| `blutmond-pakt` | de | HörbuchKI Library | | [ ] |
| `zug-47` | de | HörbuchKI Library | | [ ] |
| `second-life-protocol` | en | HörbuchKI Library | | [ ] |
| `guild-last-light` | en | HörbuchKI Library | | [ ] |
| `starlit-court` | en | HörbuchKI Library | | [ ] |
| `hexbound-academy` | en | HörbuchKI Library | | [ ] |
| `ghost-signal` | en | HörbuchKI Library | | [ ] |

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

## 6. Vor Go-Live

- [ ] Inventar-Tabelle vollständig abgehakt
- [ ] Keine Vorlage mit offensichtlichem Fanfic an fremden IP
- [ ] Cover-Ordner: README mit Generierungs-Pipeline (`docs/COVER-PROMPTS.md` verlinken)
- [ ] AGB verlinkt in App-Footer und Invite-Mail

---

## 7. Bei Meldung „Urheberrechtsverletzung“

1. Story/User identifizieren (Admin / Supabase)
2. Inhalt sperren oder Account sperren
3. Vorlage aus Bibliothek entfernen, falls betroffen
4. Dokumentation im Repo aktualisieren
