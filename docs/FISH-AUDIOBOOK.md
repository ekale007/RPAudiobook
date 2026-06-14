# Fish Audio — Audiobook-Stack

## Architektur

| Schicht | Technik | Zweck |
|---------|---------|--------|
| **Sprache** | Fish S2-Pro (`/api/tts/fish`) | Erzähler, Dialog, Multi-Voice (`reference_id` pro Figur) |
| **Emotion** | `[whisper]` `[laughing]` … | Plot/Cast → Prefix via `fishAudioDelivery.ts` |
| **Ambience/SFX/Musik** | `public/sfx/` + Web Audio | Loops & One-shots **neben** TTS, nicht im MP3 |

Fish generative SFX/Musik (Fish-API) ist **nicht** im Live-Chat — später offline → Storage.

## Einstellungen

1. **Settings → Fish Audio** (Standard auf Beta)
2. **Cast → Dynamische Stimmung** — Plot-Ort/Bedrohungen → Fish-Tags + Ambience
3. Optional im Erzähler-Text: `<<sfx:rain>>`, `<<music:tension>>`

## Tags

- `<<sfx:rain>>` — Ambience-Loop
- `<<sfx:door>>` — One-shot
- `<<music:tension>>` — Musik-Bed (Placeholder-Loops in `sfxCatalog`, durch echte MP3/OGG ersetzen)

## Code

- `src/lib/tts/fishAudioDelivery.ts` — Plot → Fish `[tags]`
- `src/lib/audio/soundscape.ts` — Tags + Plot → `{ ambient, music, oneShots }`
- `src/lib/audio/sfxPlayer.ts` — `playTurnSoundscape`, Ducking während Sprache
- `src/components/MessageAudioPlayer.tsx` — Mix beim ▶

## Musik-Assets

`music-tension`, `music-calm`, `music-mystery` nutzen vorübergehend leise Ambience-WAVs. Ersetze `path` in `sfxCatalog.ts` durch echte Musik-Loops.
