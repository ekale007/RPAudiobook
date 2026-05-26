# Kokoro-82M TTS (HörbuchKI)

Kokoro runs **on your PC** (uses your GTX 1080 Ti when CUDA is available). The app talks to `http://127.0.0.1:5124/speak` — same as edge-tts, but returns **WAV** (plays fine in the browser).

## One-time setup (Windows)

```powershell
cd D:\HörbuchKI
.\scripts\install-kokoro.ps1
```

This installs:

- **espeak-ng** (required; via Chocolatey if available)
- Python venv `.venv-kokoro` with `kokoro`, `torch`, etc.

Manual espeak only: [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases) — add to PATH.

## Hugging Face token (recommended)

Kokoro downloads `hexgrad/Kokoro-82M` from Hugging Face. Without a token you may see rate limits or failed downloads.

1. Create a token: https://huggingface.co/settings/tokens (role **Read** is enough)
2. In the repo root `.env.local` add:

   ```
   HF_TOKEN=hf_your_token_here
   ```

3. Restart `npm run tts:kokoro`

Alternative (system-wide): `hf auth login` in the same terminal before starting Kokoro.

Check: http://127.0.0.1:5124/health should show `"hf_token": true`.

## Start Kokoro

```powershell
.\.venv-kokoro\Scripts\Activate.ps1
npm run tts:kokoro
```

First start preloads the model (`--preload`). First synthesis may still take a few seconds.

CPU only (no GPU):

```powershell
npm run tts:kokoro:cpu
```

Health check: http://127.0.0.1:5124/health  
Voices list: http://127.0.0.1:5124/voices

## App settings

1. Keep `npm run dev` running (terminal 2).
2. **Settings** → **Local (free)** → Engine **kokoro**
3. Voice examples:
   - `af_bella`, `af_heart` — female narrator
   - `am_adam`, `am_michael` — male
   - `bm_george` — British male
4. **Save** → chat → **▶ Listen**

## Recommended narrator voices

| Voice | Style |
|-------|--------|
| `af_heart` | Warm, expressive (often best) |
| `af_bella` | Default in app |
| `am_adam` | Male narrator |
| `bm_george` | British male |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `espeak-ng not found` | Run `install-kokoro.ps1` or install espeak-ng |
| `Cannot reach local TTS` | Start `npm run tts:kokoro` |
| CUDA out of memory | Close other GPU apps; use `tts:kokoro:cpu` |
| Slow first line | Normal — model loads once |
| Phone has no audio | TTS runs on PC; keep Kokoro + dev server running |
| HF rate limit / 401 | Set `HF_TOKEN` in `.env.local` and restart Kokoro |
| `hf_token: false` in /health | Add token to `.env.local` or run `hf auth login` |

## Docker alternative (optional)

If Python setup fails, use Kokoro-FastAPI:

```powershell
docker run --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
```

Then set **Settings → Custom** → Server URL `http://127.0.0.1:8880` and we’d need an OpenAI adapter (not included yet). Prefer `npm run tts:kokoro`.

---

# Qwen3-TTS (later)

Port **5125** reserved. Same `/speak` contract when you add a wrapper. See [alexandria-audiobook](https://github.com/Finrandojin/alexandria-audiobook) for reference.

## Multi-voice (Phase D)

Story hub → **Character voices** (or chat → **Voices**). Each cast slug gets a Kokoro voice. In **group chat** mode, each reply bubble uses its speaker’s voice when you tap **Listen**.
