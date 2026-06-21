# Lokale Experimente (nicht Cloud-Beta)

Diese Tracks laufen **nur auf deinem PC** und sind bewusst **nicht** Teil der Vercel-Prod-Beta.

> **OSS-Hinweis:** `image-studio/`, `samples/omnivoice/` und `supabase/migrations/` sind **nicht** im öffentlichen GitHub-Repo (SaaS/Experimente beim Betreiber).

---

## Qwen3-TTS / Kokoro / RunPod

| Track | Doc |
|-------|-----|
| Kokoro (lokal, GPU) | [`KOKORO-QWEN.md`](./KOKORO-QWEN.md) |
| Qwen Cloud | [`QWEN-CLOUD.md`](./QWEN-CLOUD.md) |
| Qwen Masterplan | [`QWEN-MASTERPLAN.md`](./QWEN-MASTERPLAN.md) |
| RunPod Serverless | [`RUNPOD-SERVERLESS-QWEN.md`](./RUNPOD-SERVERLESS-QWEN.md) |

---

## Bibliotheks-Cover (Batch)

CLI ohne separate GUI — [`LOCAL-COVERS.md`](./LOCAL-COVERS.md), `npm run covers:missing`

---

## LokalAI (`d:\LokalAI`, separates Repo)

- **Nicht** RP Audiobook — eigener Stick/Assistent
- Web-UI **8765**, Recovery-Orchestrator **8766**
- CORS: UI auf 8765 → API auf 8766; Fehler `(null)` = oft Orchestrator down
- Fix in `scripts/Orchestrator.ps1` (localhost-Origins erlauben)

RP Audiobook nutzt **keine** Ports 8765/8766.
