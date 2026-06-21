# Lokale Experimente (nicht Cloud-Beta)

Diese Tracks laufen **nur auf deinem PC** und sind bewusst **nicht** Teil der Vercel-Prod-Beta.

---

## Image Studio (`image-studio/`)

- **Zweck:** SDXL-Turbo Cover & Avatare mit OpenRouter-Prompt-Hilfe
- **Ports:** Web 5173 (Dev), API 5125
- **Start:** `cd image-studio && npm run dev` oder `npm run image-studio` aus Repo-Root
- **HörbuchKI:** `/dev/image-generator` verweist hierher; Batch-Cover weiter `npm run covers:missing`

→ [`image-studio/README.md`](../image-studio/README.md)

---

## OmniVoice (`samples/omnivoice/`)

- **Zweck:** Lokales Multi-Voice-TTS (Clone/Design), Qualitätsvergleich zu Fish/Kokoro
- **Scripts:** `npm run tts:omnivoice:install`, `tts:omnivoice:refs`, `tts:omnivoice:probe`
- **Assets:** `refs/` (edge-tts Referenzen), `probes/` (Modell-Ausgaben), `manifest.json`

→ [`samples/omnivoice/README.md`](../samples/omnivoice/README.md)

---

## Qwen3-TTS / Kokoro / RunPod

| Track | Doc |
|-------|-----|
| Kokoro (lokal, GPU) | [`KOKORO-QWEN.md`](./KOKORO-QWEN.md) |
| Qwen Cloud | [`QWEN-CLOUD.md`](./QWEN-CLOUD.md) |
| Qwen Masterplan | [`QWEN-MASTERPLAN.md`](./QWEN-MASTERPLAN.md) |
| RunPod Serverless | [`RUNPOD-SERVERLESS-QWEN.md`](./RUNPOD-SERVERLESS-QWEN.md) |

---

## LokalAI (`d:\LokalAI`, separates Repo)

- **Nicht** RP Audiobook — eigener Stick/Assistent
- Web-UI **8765**, Recovery-Orchestrator **8766**
- CORS: UI auf 8765 → API auf 8766; Fehler `(null)` = oft Orchestrator down
- Fix in `scripts/Orchestrator.ps1` (localhost-Origins erlauben)

RP Audiobook nutzt **keine** Ports 8765/8766.
