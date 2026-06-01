# ElevenLabs — dynamische Stimmung (v3 Audio Tags)

## Was vorher fehlte

`eleven_multilingual_v2` bekam nur feste `voice_settings` (Stability/Style) pro Sprache — **kein** Cast-instruct, **kein** Plot-Stimmung.

## Test: Eleven v3

1. Settings → **ElevenLabs** → Haken **Eleven v3 (Test)** (setzt `model_id: eleven_v3`)
2. Cast → **Szenen-Stil** an (nutzt dieselbe Logik wie Qwen)
3. Optional: pro Figur **Qwen-Stimmen-Editor** / `qwenVoiceProfiles` — `designInstruct` wird auch für Eleven in Audio-Tags übersetzt
4. Story ▶ — Erzähler + Dialog mit Multi-Voice wie bisher

## Technik

| Qwen | Eleven v3 |
|------|-----------|
| `instructions: "warm, gentle…"` | `[whispers]` `[softly]` `[laughs softly]` im Text |
| `qwen3-tts-instruct-flash` | `eleven_v3` |
| Plot + Absatz → instruct | Plot + Absatz → Tag + Stability/Style |

Code: `src/lib/tts/elevenLabsDelivery.ts`, `resolveStoryDelivery.ts`

## Ambience (leicht)

Bei aktivem Szenen-Stil: `plotState.location` → optional Loop (`rain`, `city`, …) unter TTS. Dateien in `public/sfx/`. Tags im Text: `<<sfx:rain>>`.

## Roadmap (LLM)

- Erzähler schreibt `<<sfx:…>>` + Audio-Tags direkt im Turn
- LLM mappt Plot → Ambience + delivery in einem Schritt
- Ducking TTS vs. Ambience

## Kosten

Eleven v3 ist teurer als `eleven_multilingual_v2` — nur für Tests / Premium-Tier.
