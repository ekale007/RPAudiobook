# Soundeffekte (SFX) — Plan

Kein TTS — **kurze Audio-Clips** parallel zur Sprachausgabe.

## Free Libraries (Lizenz beachten)

| Quelle | Lizenz | Nutzung |
|--------|--------|---------|
| [Kenney.nl](https://kenney.nl/assets?q=audio) | CC0 | UI, Natur, Schritte |
| [OpenGameArt.org](https://opengameart.org/) | CC0 / CC-BY | Ambiente, Fantasy |
| [Freesound.org](https://freesound.org/) | CC0 filter | Alles — **Attribution in `public/sfx/CREDITS.md`** |
| [Soniss GDC bundles](https://sonniss.com/gameaudiogdc) | Royalty-free | Jahres-SFX-Pakete |
| [BBC Sound Effects (archive)](https://sound-effects.bbcrewind.co.uk/) | RemArc personal/edu | Nicht kommerziell ohne Lizenz |

**Empfehlung für Beta:** Kenney + CC0-Freesound, 20–40 kurze OGG (<500 KB).

## App-Integration (Stand Code)

1. **Tags im Story-Text** (optional, Erzähler setzt):
   - `<<sfx:rain>>` — leiser Regen-Loop
   - `<<sfx:door>>` — Tür knarrt (one-shot)

2. **Plot-State** (später): `location: "Straße im Regen"` → auto `rain` Ambience

3. **Katalog:** `src/lib/audio/sfxCatalog.ts` — id → `/sfx/…ogg`

4. **Player:** `src/lib/audio/sfxPlayer.ts` — Web Audio, parallel zu TTS

5. **Dateien:** `public/sfx/*.{ogg,wav}` — OGG (Kenney UI) + WAV (Ambience)

## Dateien hinzufügen

```text
public/sfx/
  rain.ogg          # loop, leise
  door.ogg          # one-shot
  footsteps.ogg
  fire.ogg
  wind.ogg
  thunder.ogg
  city.ogg
  CREDITS.md        # Quelle + Lizenz pro Datei
```

Download z. B. Kenney «Impact Sounds» / «RPG Audio» → export OGG → umbenennen.

## Mix-Regeln (Ziel)

| Typ | Lautstärke | Verhalten |
|-----|------------|-----------|
| Ambience (rain, city) | 8–15% | Loop während Szene |
| One-shot (door, thunder) | 25–40% | einmal am Tag-Start |
| Unter TTS | duck −6 dB | wenn Erzähler spricht |

## Roadmap

- [x] Tag-Parser + Katalog + Player beim ▶
- [x] Kenney OGG + Ambience WAV in `public/sfx/`
- [x] Plot-State → automatische Ambience (wind/city/thunder/rain via WAV)
- [ ] Supabase Storage für eigene SFX pro Story
