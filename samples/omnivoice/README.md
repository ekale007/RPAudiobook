# OmniVoice — Referenzen & Probes (lokal)

Synthetische **Referenz-Clips** (via Microsoft edge-tts, nur für Tests) und **Probe-Ausgaben** von [k2-fsa/OmniVoice](https://huggingface.co/k2-fsa/OmniVoice).

## Schnellstart

```powershell
# 1) Referenz-WAVs bauen (Internet, edge-tts; ffmpeg empfohlen)
pip install edge-tts
python scripts/omnivoice-build-refs.py

# 2) OmniVoice-Umgebung + Modell
npm run tts:omnivoice:install

# 3) Probe-Clips erzeugen (GPU empfohlen, erster Lauf lädt ~0,6B)
npm run tts:omnivoice:probe
# oder schneller: npm run tts:omnivoice:probe:fast
```

## Inhalt

| Ordner | Inhalt |
|--------|--------|
| `manifest.json` | 6 Referenzen (DE/EN) + 10 Probe-Ziele (clone / design / auto) |
| `refs/` | 24 kHz Mono-WAV, 3–8 s, mit `ref_text` für Cloning |
| `probes/` | OmniVoice-Ausgabe pro Probe-ID (`de_clone_story_01.wav`, …) |

## Referenzen (Stimmen)

| ID | Quelle (edge-tts) | Rolle |
|----|-------------------|--------|
| `de_narrator_female` | de-DE-KatjaNeural | DE Erzählerin |
| `de_narrator_male` | de-DE-ConradNeural | DE Erzähler |
| `de_protagonist_neutral` | de-DE-AmalaNeural | DE Dialog / Protagonist |
| `en_narrator_female` | en-US-JennyNeural | EN Erzählerin |
| `en_narrator_male` | en-US-GuyNeural | EN Erzähler |
| `en_gb_narrator` | en-GB-SoniaNeural | EN (britisch) |

## Probes (Modi)

- **clone** — gleiche Sprache wie Referenz, Text aus Hörbuch-Szenen
- **design** — ohne Referenz, nur `instruct` (laut Doku vor allem EN stabil)
- **auto** — Modell wählt Stimme selbst
- **nonverbal** — `[laughter]` im Text

## Hinweise

- Referenzen sind **künstlich** (TTS), kein echtes Stimm-Cloning von Personen.
- Für echte Cast-Stimmen später: eigene 3–10 s Aufnahmen + Transkript in `manifest.json` eintragen.
- `HF_TOKEN` in `.env.local` beschleunigt Modell-Download.
