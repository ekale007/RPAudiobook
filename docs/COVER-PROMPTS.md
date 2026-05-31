# Bibliotheks-Cover — Bild-Prompts

16 Vorlagen haben noch **kein** Cover-Bild (nur Farbverlauf). 4 haben bereits Dateien unter `public/library-covers/`.

## Empfohlener Workflow

1. **Einheitlicher Stil** — alle mit dem gleichen Präfix generieren (Midjourney, DALL·E, Ideogram, …).
2. **Format:** Hochformat **2:3**, ca. **600×900 px**, als **WebP** speichern.
3. **Kein Text** im Bild (Titel kommt in der App).
4. Dateiname = `{id}.webp` (siehe Tabelle), in `public/library-covers/` legen.
5. In `src/lib/story/libraryTemplates.ts` bzw. `libraryTemplatesExtra.ts` optional `coverImageSrc: "/library-covers/….webp"` setzen — oder wir tragen das nach dem Upload ein.

### Stil-Präfix (vor jeden Prompt setzen)

```
Audiobook cover illustration, vertical portrait 2:3, painterly cinematic digital art, rich lighting, no text, no title, no logos, no watermark,
```

---

## Fehlende Cover (16)

| Dateiname | Titel | Prompt (ohne Präfix) |
|-----------|-------|----------------------|
| `haunted-lake.webp` | Das Haus am Schwarzen See | horror audiobook, isolated lake house in pine forest during storm, single warm window light, wooden dock into black water, rain and mist, subtle silhouette under dock, moody teal and charcoal palette |
| `midnight-bakery.webp` | Mitternacht in der Bäckerei | cozy mystery audiobook, warm bakery interior at night, glowing oven, flour dust in air, cat before cellar door, small town mood, soft amber and lavender tones |
| `iron-republic.webp` | The Iron Republic | steampunk audiobook, brass airship sky-dock, steam fog, giant gears and gantries, sealed crate with mysterious crest, Victorian-industrial aesthetic, copper and teal palette |
| `neon-witness.webp` | Neon Witness | cyberpunk noir audiobook, rainy rooftop at night, neon hologram ads, black corporate tower, glowing data chip in hand, drone searchlight, magenta and cyan palette |
| `desert-oath.webp` | Der Eid der Oase | desert fantasy audiobook, oasis camp at night, caravan fires, ancient artifact glow, sandstorm wall on horizon, starry sky, warm gold and deep umber palette |
| `tide-line.webp` | The Tide Line | coastal drama audiobook, weathered seaside cottage, low tide exposing pier pilings, kelp and old phone in wrack line, overcast golden light, emotional mood, slate blue and sand tones |
| `schatten-kaiser.webp` | Schattenkaiser | dark fantasy isekai audiobook, obsidian palace under blood moon, hooded procession in rain-slick alley, glowing black sigil on hand, purple and charcoal palette |
| `akademie-arkanum.webp` | Akademie Arkanum | magic academy audiobook, floating candles in great hall, four house banners, enchanted wand, warm blue and gold palette |
| `system-null.webp` | System Null | isekai RPG audiobook, fantasy village edge, holographic blue status window overlay, moss landing, tutorial quest glow, teal and emerald palette |
| `blutmond-pakt.webp` | Blutmond-Pakt | urban fantasy vampire audiobook, neon nightclub black glass facade, red rain reflections, blood seal invitation, noir mood, crimson and black palette |
| `zug-47.webp` | Zug 47 | post-apocalyptic audiobook, armored train in dark tunnel, radio glow in cabin, desperate survivors, rust and amber palette |
| `second-life-protocol.webp` | Second Life Protocol | corporate isekai VR audiobook, fantasy meadow with holographic UI overlay, greyed logout button motif, starter village gate, cyan and violet palette |
| `guild-last-light.webp` | Guild of the Last Light | adventurer guild fantasy audiobook, leaky guild hall, quest board with dungeon pin, rainy cobblestone, torchlight, warm amber palette |
| `starlit-court.webp` | The Starlit Court | space opera audiobook, orbital palace ballroom, starlight chandeliers, masked figures, fleet lights through glass, gold and indigo palette |
| `hexbound-academy.webp` | Hexbound Academy | magic academy audiobook, floating island school, cursed dorm door number 13, founder statue with glowing hex runes, crimson and midnight blue palette |
| `ghost-signal.webp` | Ghost Signal | spy thriller audiobook, safehouse shortwave radio, redacted mission packet, fluorescent noir, clock showing 17 minutes, slate and red accent palette |

## Bereits vorhanden

| Datei | Titel |
|-------|-------|
| `crossroads-inn.webp` | Das Gasthaus am Scheideweg |
| `station-echo.webp` | Station Echo |
| `last-letter.webp` | Der letzte Brief |
| `when-dawn-breaks.jpeg` | When Dawn Breaks |

## Lokal generieren (kostenlos)

Ohne Cloud-Budget: **[LOCAL-COVERS.md](./LOCAL-COVERS.md)** — `npm run covers:install` dann `npm run covers:missing` (SDXL-Turbo, GTX 1080 Ti).

| Option | Pro | Contra |
|--------|-----|--------|
| **Du** (Midjourney o.ä.) | Einheitlicher Stil, beste Qualität | Manueller Aufwand |
| **Cursor Generate Image** | Schnell einzelne Tests | 16 Bilder = uneinheitlicher Stil, manuell WebP + Upload |

**Empfehlung:** Du generierst mit gleichem Präfix in einem Batch. Wenn du willst, kann ich **1–2 Beispiel-Cover** hier generieren zum Abgleich des Stils — den Rest dann du.

Die vollständigen Prompts stehen auch in Code: `coverImagePrompt` in `libraryTemplates.ts` / `libraryTemplatesExtra.ts`.
