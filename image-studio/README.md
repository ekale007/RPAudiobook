# Image Studio

Eigenständiges Bildstudio für **lokale GPU-Generierung** (SDXL-Turbo) mit **Standardformaten** und **KI-Prompt-Optimierung** (OpenRouter).

Ausgelagert aus HörbuchKI — kann später als eigenes Git-Repo genutzt werden.

## Voraussetzungen

- Windows + NVIDIA GPU (oder `-CpuOnly`, sehr langsam)
- Python 3.10+
- Node.js 20+

## Einmalig

```powershell
cd image-studio
npm install
```

**Python/GPU** — eine der Optionen:

```powershell
# A) eigenes venv in image-studio
.\scripts\install.ps1

# B) bereits HörbuchKI covers venv? reicht — run-server nutzt ../.venv-covers automatisch
cd ..
npm run covers:install
cd image-studio
```

Optional: `copy .env.example .env` (HF_TOKEN, OPENROUTER_API_KEY)

## Entwicklung (GUI + GPU-Server)

```powershell
npm run dev
```

- Web-UI: http://localhost:5173 (Vite, proxied API)
- GPU-API: http://127.0.0.1:5125

## Production lokal (ein Prozess)

```powershell
npm run start
```

Baut die UI nach `web/dist/` und startet den Server — UI unter http://127.0.0.1:5125

## Formate

| Format | Größe | Einsatz |
|--------|-------|---------|
| Buchcover 2:3 | 768×1152 | Hörbuch-Cover |
| Porträt 1:1 | 768×768 | Figuren |
| Szene 3:2 | 1152×768 | Landschaft |
| Banner 16:9 | 1344×768 | Key-Art |
| Quadrat 1:1 | 768×768 | Allgemein |
| Vorschau | 512×512 | Schnelltest |

## KI-Optimierung

- Kurzidee auf Deutsch eingeben → **KI-Prompt optimieren**
- OpenRouter-Key in der UI (Einstellungen) oder `OPENROUTER_API_KEY` in `.env`
- Ausgabe: englischer SDXL-Prompt (Stil-Präfix wird beim Generieren ergänzt)

## API

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /api/health` | Server-Status |
| `POST /api/generate` | WebP-Bild (JSON: prompt, width, height, steps, seed) |
| `POST /api/optimize-prompt` | KI-Prompt (JSON: brief, format_*, api_key optional) |

## Eigenes Repo anlegen

```powershell
cd ..
git subtree split -P image-studio -b image-studio-only
# oder Ordner kopieren und git init
```

HörbuchKI nutzt weiterhin `npm run covers:*` für Batch-Bibliotheks-Cover — siehe `docs/LOCAL-COVERS.md` im Hauptprojekt.
