# Local TTS (free testing)

ElevenLabs needs a paid plan for serious use. For **free narrator tests** you have three tiers:

## 1. Recommended for quick tests: edge-tts (free, needs internet)

Uses Microsoft neural voices. No API key. Runs on your PC.

### Requirements

- **Python 3.10+** ([python.org](https://www.python.org/downloads/))
- Internet while generating audio
- HörbuchKI + TTS server on the **same machine** (localhost)

### Setup (Windows)

```powershell
cd D:\HörbuchKI
python -m venv .venv-tts
.\.venv-tts\Scripts\Activate.ps1
pip install -r scripts/requirements-tts.txt
```

### Run (keep this terminal open)

```powershell
npm run tts:server
# or: python scripts/local-tts-server.py
```

In another terminal:

```powershell
npm run dev
```

In the app: **Settings → TTS → Local (free)** → Save. In chat, tap **▶ Listen**.

### Good English narrator voices

| Voice | ID |
|--------|-----|
| Andrew (male narrator) | `en-US-AndrewNeural` |
| Guy | `en-US-GuyNeural` |
| Jenny (female) | `en-US-JennyNeural` |
| Sonia (UK female) | `en-GB-SoniaNeural` |

List all voices:

```powershell
edge-tts --list-voices
```

---

## 2. Fully offline: Piper (CPU, no GPU required)

Good for privacy and no internet. Quality is decent, not ElevenLabs-level.

### Requirements

- ~200 MB disk per voice
- No NVIDIA GPU needed (CPU is fine)

### Setup

1. Download **Piper** for Windows from [OHF-Voice/piper1-gpl releases](https://github.com/OHF-Voice/piper1-gpl/releases)
2. Download a voice, e.g. `en_US-lessac-medium` from [Hugging Face piper voices](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac/medium)
3. Run Piper HTTP or call `piper` CLI; point HörbuchKI local server URL at that service

Example CLI test:

```powershell
echo Hello from Piper. | piper.exe -m en_US-lessac-medium.onnx -f test.wav
```

To integrate with HörbuchKI today, either wrap Piper in a small FastAPI server (same `/speak` contract as `local-tts-server.py`) or extend `scripts/local-tts-server.py` with a `--engine piper` flag.

---

## 3. Best local quality (your GTX 1080 Ti, 11 GB VRAM)

Your GPU is enough for stronger models:

| Engine | VRAM (approx.) | Quality | Notes |
|--------|----------------|---------|--------|
| **Kokoro-82M** | ~2–4 GB | High | Fast, good for narrator |
| **Qwen3-TTS** | ~6–8 GB | Very high | Voice design / clone |
| **Chatterbox** | ~8 GB | High | Turbo variant fits 1080 Ti |

Projects to explore (run separately, then expose HTTP `/speak`):

- [TTS-Story / Kokoro-Story](https://github.com/Xerophayze/Kokoro-Story) — web UI + multi-engine
- [alexandria-audiobook](https://github.com/Finrandojin/alexandria-audiobook) — Qwen3-TTS + LLM script

HörbuchKI only needs a server on `http://127.0.0.1:5123/speak` with JSON `{ "text": "...", "voice": "..." }` returning MP3 or WAV.

---

## Phone + local TTS

The TTS server must run on the PC where `npm run dev` runs. The phone browser talks to Next.js on your LAN; Next.js calls `127.0.0.1:5123` on that PC. So: **PC on, both terminals running**, open `http://<PC-IP>:3000` on the phone.

---

## Troubleshooting

| Error | Fix |
|--------|-----|
| Cannot reach local TTS | Start `npm run tts:server` |
| Python not found | Install Python, use `py -3` on Windows |
| edge-tts fails | Check internet / firewall |
| Slow first play | Normal; audio is cached after first generation |
