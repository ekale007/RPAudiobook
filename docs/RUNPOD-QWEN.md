# Qwen3-TTS on RunPod

FastAPI server — same API as local `npm run tts:qwen` (`/health`, `/speak`, `/voices`, `/ping`).

## Pod vs. Serverless

| | **Serverless (empfohlen)** | **GPU Pod (legacy)** |
|--|---------------------------|----------------------|
| Kosten | Nur bei Requests | $/h auch im Leerlauf |
| URL | `https://<ID>.api.runpod.ai` | `https://<pod>-8000.proxy.runpod.net` |
| Auth | `RUNPOD_API_KEY` + `QWEN_TTS_API_KEY` | nur `QWEN_TTS_API_KEY` |
| Setup | [RUNPOD-SERVERLESS-QWEN.md](./RUNPOD-SERVERLESS-QWEN.md) | unten |

---

## GPU Pod (legacy)

## 1. Build & push (optional — or build on RunPod)

```bash
docker build -f runpod/Dockerfile -t hoerbuchki-qwen-tts .
docker tag hoerbuchki-qwen-tts YOUR_REGISTRY/hoerbuchki-qwen-tts:latest
docker push YOUR_REGISTRY/hoerbuchki-qwen-tts:latest
```

## 2. RunPod Pod

1. [RunPod Console](https://www.runpod.io/console/pods) → **Deploy**
2. GPU: **RTX 4090 / A4000 / L4** (≥16 GB VRAM for 1.7B; **0.6B** fits 8 GB)
3. Template: **RunPod PyTorch** or custom Docker image from above
4. **Expose HTTP**: Port **8000** (TCP public)
5. Environment variables:

| Variable | Required | Example |
|----------|----------|---------|
| `HF_TOKEN` | yes | Hugging Face read token |
| `QWEN_API_KEY` | yes (prod) | random secret — must match Vercel `QWEN_TTS_API_KEY` |
| `QWEN_MODEL` | no | `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` |
| `QWEN_DEVICE` | no | `cuda` |

6. Start command (if not using Dockerfile CMD):

```bash
bash /app/runpod/start.sh
```

7. After start: `https://<pod-id>-8000.proxy.runpod.net/health` → `{ "ok": true, "engine": "qwen3-tts-custom-voice" }`

First `/speak` loads the model (1–3 min). Use **preload** in start script.

## 3. Vercel / Next.js

```env
QWEN_TTS_URL=https://<pod-id>-8000.proxy.runpod.net
QWEN_TTS_API_KEY=<same as QWEN_API_KEY on pod>
NEXT_PUBLIC_SERVER_QWEN_TTS=1
HF_TOKEN=...   # only on RunPod, not Vercel
```

App route: `POST /api/tts/qwen` (auth + rate limit) → proxies to RunPod.

## 4. Costs (rough)

| GPU | ~$/hr | Notes |
|-----|-------|-------|
| RTX 4090 | 0.34–0.50 | fast, good for 1.7B |
| L4 / A4000 | 0.20–0.35 | enough for 0.6B |
| Spot / interruptible | −30–50% | ok with warm pod + cache |

**Tip:** Turn pod **off** when not testing; Turn-Audio-Cache in Supabase avoids re-synth.

## 5. Voice profiles (app)

Per story in `settings.qwenVoiceProfiles`:

- `presetSpeaker` (Ryan, Serena, …)
- `designInstruct` — style hint per character
- `sceneInstruct` — merged from plot-state (location, mood)

See `src/lib/tts/qwenVoiceProfiles.ts`.

## 6. Local dev (same API)

```bash
npm run tts:qwen:install
npm run tts:qwen
# Settings → Local → Engine Qwen → http://127.0.0.1:5125
```

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| 503 from Vercel | Pod stopped? `/health` in browser |
| 401 | `QWEN_TTS_API_KEY` mismatch |
| CUDA OOM | Use 0.6B model or larger GPU |
| Slow first line | `--preload` in start.sh; keep pod warm |

See also: [QWEN-MASTERPLAN.md](./QWEN-MASTERPLAN.md), [SFX.md](./SFX.md)
