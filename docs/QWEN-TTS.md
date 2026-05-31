# Qwen3-TTS (HörbuchKI)

> **Hinweis:** Für den Alltag ist **Kokoro** die empfohlene Engine. Qwen ist experimentell (langsam, nur Preset-Stimmen). Geplannte Optimierung und **Stimmen pro Figur**: [`docs/QWEN-MASTERPLAN.md`](./QWEN-MASTERPLAN.md).

Qwen3-TTS runs on your PC (GPU empfohlen). Die App spricht mit `http://127.0.0.1:5125/speak` — gleiche API wie Kokoro (JSON `{ text, voice }` → WAV).

## Was Qwen kann

| Modell | Funktion |
|--------|----------|
| **CustomVoice** (Standard) | 9 feste Stimmen + `instruct` für Stil |
| **VoiceDesign** | Stimme per Textbeschreibung erzeugen |
| **Base** | Voice-Cloning aus Referenz-Audio (~3 s) |

Der mitgelieferte Server nutzt **CustomVoice 0.6B** (schneller auf GTX 1080 Ti). Größere Modelle per Start-Flag.

## Setup (Windows)

```powershell
cd D:\HörbuchKI
npm run tts:qwen:install
```

`HF_TOKEN` in `.env.local` (wie bei Kokoro) — Modelle werden von Hugging Face geladen.

## Start

```powershell
npm run tts:qwen
```

Erster Start lädt das Modell (kann Minuten + mehrere GB dauern). Health: http://127.0.0.1:5125/health

Größeres Modell (bessere Qualität, mehr VRAM):

```powershell
npm run tts:qwen:large
```

## App

1. `npm run dev` (zweites Terminal)
2. **Settings** → **Local** → Engine **qwen**
3. Stimme z. B. `Ryan`, `Vivian`, `Serena` (siehe `/voices`)
4. **Save** → Chat → TTS-Autoplay oder ▶

## Stimmen (CustomVoice)

| Voice | Beschreibung |
|-------|----------------|
| Ryan | Englisch, dynamisch (gut als Erzähler) |
| Aiden | Englisch, klar |
| Vivian / Serena | Chinesisch (funktionieren auch für EN) |
| Dylan, Eric, Uncle_Fu | Dialekte / männlich |
| Ono_Anna, Sohee | JP / KR |

Aliase: `default`, `alloy` → Ryan; `nova` → Serena; Kokoro-IDs werden gemappt.

## Stimme „gestalten“

- **CustomVoice:** optionales Feld `instruct` im Server (Stil-Hinweis), z. B. „tired, whispering“.
- **VoiceDesign:** separates Modell — Stimme komplett per Beschreibung (später eigener Endpunkt möglich).
- **Clone:** `1.7B-Base` + Referenz-WAV — für feste Figuren-Stimmen aus Sample.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| torchaudio / DLL error | `npm run tts:qwen:install` erneut (matched torch+torchaudio) |
| CUDA OOM | `npm run tts:qwen:cpu` oder 0.6B statt 1.7B |
| Langsam | Normal beim ersten `/speak` |
| `hf_token: false` | `HF_TOKEN` in `.env.local` |
