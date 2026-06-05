# Qwen3-TTS auf RunPod Serverless (Load Balancer)

GPU-Pod durch **Serverless** ersetzen: gleiche API (`/health`, `/speak`, `/voices`), aber **keine Idle-Kosten**. Die App spricht weiter über `POST /api/tts/qwen`.

Vergleich Pod vs. Serverless: [RUNPOD-QWEN.md](./RUNPOD-QWEN.md#pod-vs-serverless).

## Architektur

```
Browser → Vercel /api/tts/qwen → https://<ENDPOINT_ID>.api.runpod.ai/speak
           Authorization: Bearer RUNPOD_API_KEY
           X-API-Key: QWEN_TTS_API_KEY
```

RunPod Load Balancer erwartet `/ping` (204 = Modell lädt, 200 = bereit). Das ist im Qwen-Server eingebaut.

## 1. Deploy via GitHub (empfohlen)

`HF_TOKEN` wird **nicht** ins Image gebacken — nur als Env auf RunPod setzen.

Das Repo enthält ein **`Dockerfile` im Root** (Build-Kontext = gesamtes Repo). RunPod baut daraus automatisch.

### Ersteinrichtung

1. RunPod mit GitHub verbinden: [Settings → Connections](https://www.runpod.io/console/user/settings)
2. [Serverless](https://www.runpod.io/console/serverless) → **New Endpoint** → **Import Git Repository**
3. Repository: `ekale007/RPAudiobook`
4. Branch: `master`
5. Repository-Konfiguration (wichtig — sonst `Repo-Root not found`):

| Feld | Wert |
|------|------|
| Dockerfile path | `Dockerfile` |
| Build context | leer oder `.` |
| **Nicht** verwenden | `Repo-Root` (nur UI-Label!) |

6. Endpoint Type: **Load Balancer**, expose Port **80**
7. Env-Variablen (Schritt 2 unten) → **Deploy**

Erster Build: oft **15–40 Min** (PyTorch + pip). Status unter Endpoint → **Builds**.

Docs: [Deploy from GitHub](https://docs.runpod.io/serverless/workers/github-integration)

### Nach Code-Änderungen neu deployen

RunPod zieht Updates per **GitHub Release**, nicht automatisch bei jedem Push:

1. Auf GitHub: **Releases** → **Draft a new release** (Tag z. B. `runpod-qwen-v1`)
2. RunPod Endpoint → **Builds** — neuer Build startet
3. Oder Endpoint → **Repository Configuration** → Branch prüfen → manuell Rebuild (falls angeboten)

### Bestehenden fehlgeschlagenen Endpoint reparieren

1. Endpoint öffnen → **Repository Configuration** / **Edit**
2. Dockerfile: `Dockerfile`, Build context: leer
3. Sicherstellen, dass `master` auf GitHub das Root-`Dockerfile` enthält (`git pull` auf github.com prüfen)
4. Neues **GitHub Release** erstellen oder Rebuild triggern

### Optional: lokaler Build (nur zum Testen des Dockerfiles)

```powershell
docker build --platform linux/amd64 -f Dockerfile -t hoerbuchki-qwen-tts:test .
```

## 2. RunPod Endpoint anlegen

1. [Serverless](https://www.runpod.io/console/serverless) → **New Endpoint**
2. **Import from Docker Registry** → `YOUR_USER/hoerbuchki-qwen-tts:serverless`
3. **Endpoint Type:** **Load Balancer** (nicht Queue!)
4. **GPU:** L4 oder RTX 4090 (0.6B-Modell reicht mit ≥16 GB; 8 GB knapp)
5. **Expose HTTP Ports:** `80`
6. **Environment variables:**

| Variable | Pflicht | Beispiel |
|----------|---------|----------|
| `HF_TOKEN` | **ja** | Hugging Face Read-Token — **muss** auf RunPod stehen (nicht nur `.env.local`) |
| `QWEN_API_KEY` | ja (prod) | Zufallsstring — gleich wie `QWEN_TTS_API_KEY` auf Vercel |
| `QWEN_MODEL` | nein | `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` |
| `QWEN_DEVICE` | nein | `cuda` |
| `QWEN_PRELOAD` | nein | `1` (Modell im Hintergrund laden) |
| `PORT` | nein | `80` (Default im Image) |

7. **Scaling (Start-Empfehlung):**

| Setting | Wert | Warum |
|---------|------|-------|
| Min workers | `0` | Keine Kosten im Leerlauf |
| Max workers | `1`–`2` | Beta reicht |
| Idle timeout | `30`–`120` s | Warm halten vs. Kosten |
| FlashBoot | an | Kürzerer Cold Start |

8. **Deploy** → Endpoint-ID notieren (z. B. `abc123xyz`)

Öffentliche Basis-URL:

```text
https://<ENDPOINT_ID>.api.runpod.ai
```

## 3. Vercel / `.env.local`

```env
# RunPod Serverless (Load Balancer)
QWEN_TTS_URL=https://<ENDPOINT_ID>.api.runpod.ai
RUNPOD_API_KEY=rpa_...          # RunPod Account → Settings → API Keys
QWEN_TTS_API_KEY=<wie QWEN_API_KEY auf RunPod>
NEXT_PUBLIC_SERVER_QWEN_TTS=1
```

`RUNPOD_API_KEY` ist **nur Server** (Vercel). Nie `NEXT_PUBLIC_*`.

## 4. Testen

Nach Deploy (Cold Start: Worker startet, `/ping` → 204, dann 200):

```powershell
npm run runpod:qwen:probe
```

Oder mit Parametern:

```powershell
.\scripts\runpod-qwen-probe.ps1 `
  -BaseUrl "https://<ENDPOINT_ID>.api.runpod.ai" `
  -RunPodApiKey $env:RUNPOD_API_KEY `
  -QwenApiKey $env:QWEN_TTS_API_KEY
```

Erfolg: `/ping` → 200, `/speak` → WAV-Datei wird abgespielt.

## 5. Cold Start

| Phase | Dauer (typ.) | Was passiert |
|-------|----------------|--------------|
| Worker startet | 30–90 s | Container hoch |
| Modell lädt | 1–3 min | `/ping` = 204 |
| Bereit | — | `/ping` = 200, `/speak` schnell |

**Tipps:** Min workers = 1 während Beta-Tests; danach 0. Turn-Audio-Cache in Supabase vermeidet Re-Synth.

Die App-Proxy-Route wartet bis **5 Min** und macht bei 502/503 bis zu 3 Retries.

## 6. Kosten (grob)

- Kein `$0.30/h` für schlafenden Pod
- Nur GPU-Sekunden während Worker aktiv + Request
- Erster `/speak` nach Idle = teuerster Request (Cold Start)

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build: `Repo-Root` not found | Build-Kontext leer oder `.`; Dockerfile = `Dockerfile`. Nie `Repo-Root` eintragen. |
| GitHub-Build nutzt alten Code | `git push` + neues GitHub **Release** erstellen |
| `no workers available` | 30–60 s warten, erneut; Min workers ≥ 1 |
| `401` von RunPod | `RUNPOD_API_KEY` auf Vercel prüfen |
| `401` von Qwen | `QWEN_TTS_API_KEY` = `QWEN_API_KEY` auf Endpoint |
| `QB API not allowed` | Endpoint-Typ muss **Load Balancer** sein |
| `/ping` 503 im Worker-Log | Worker-Logs: `background preload failed` — fast immer **`HF_TOKEN` fehlt** auf RunPod |
| `/ping` 400 vom Probe | RunPod-Gateway wenn kein gesunder Worker; Worker-Logs prüfen (503 = unhealthy) |
| `/ping` bleibt 204 | Modell lädt noch (1–3 Min) — warten |
| Timeout 330 s | Modell zu groß → `QWEN_MODEL` 0.6B |

## 8. Agent / lokale API-Nutzung

Du kannst mir **keinen** API-Key im Chat schicken (Sicherheit). Stattdessen:

1. Keys nur in `.env.local` (gitignored)
2. Endpoint in RunPod deployen
3. Mir sagen: „Probe läuft“ — ich führe `npm run runpod:qwen:probe` in deiner Umgebung aus

Ich kann die **RunPod Console** nicht bedienen — nur API-Calls von deinem Rechner/Vercel. Deploy bleibt bei dir (oder CI mit Registry-Push).

Siehe auch: [QWEN-TTS.md](./QWEN-TTS.md), [QWEN-MASTERPLAN.md](./QWEN-MASTERPLAN.md)
