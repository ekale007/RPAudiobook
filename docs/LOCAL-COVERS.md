# Lokale Cover-Generierung (kostenlos, offline nach Download)

Nutzt **SDXL-Turbo** auf deiner **GTX 1080 Ti** (~30–90 Sekunden pro Cover).

## Einmalig installieren

```powershell
cd D:\HörbuchKI
npm run covers:install
```

- Legt `.venv-covers` an (eigene Python-Umgebung, getrennt von Kokoro)
- Lädt PyTorch + CUDA 12.1 + diffusers
- Beim **ersten Generieren** lädt Hugging Face das Modell (~6–7 GB) — kostenlos; `HF_TOKEN` in `.env.local` beschleunigt den Download (gleicher Token wie für Kokoro)

Nur CPU (sehr langsam):

```powershell
npm run covers:install:cpu
```

## Cover erzeugen

```powershell
# Was fehlt noch?
npm run covers:list-missing

# Alle fehlenden generieren (aktuell 4 Stück)
npm run covers:missing

# Einzelnes Cover
npm run covers:generate -- --id guild-last-light

# Nochmal mit anderem Seed
npm run covers:generate -- --id ghost-signal --seed 123 --force
```

Ausgabe: `public/library-covers/{id}.webp` (768×1152, 2:3)

## Nach dem Generieren

1. In `libraryTemplatesExtra.ts` für neue Dateien `coverImageSrc: "/library-covers/….webp"` setzen (oder mich fragen)
2. App neu laden — Drehteller zeigt echte Cover
3. Optional commit + push

## Optionen (Experte)

```powershell
.\scripts\run-covers.ps1 --missing --steps 6 --seed 42
.\scripts\run-covers.ps1 --all --force
```

| Flag | Bedeutung |
|------|-----------|
| `--list-missing` | Nur anzeigen, was fehlt |
| `--missing` | Fehlende `.webp` erzeugen |
| `--id NAME` | Ein Template |
| `--force` | Vorhandene überschreiben |
| `--device cpu` | Ohne GPU |
| `--steps 4` | Qualität/Geschwindigkeit (Turbo: 1–6) |

Prompts kommen automatisch aus `libraryTemplates.ts` / `libraryTemplatesExtra.ts` (`coverImagePrompt`).

Siehe auch: [COVER-PROMPTS.md](./COVER-PROMPTS.md)
