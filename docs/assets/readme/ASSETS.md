# README media assets

Files in this folder are embedded in the [GitHub README](../../README.md).

## Playback on GitHub

GitHub README **does not** inline-play repo-relative `.mp3` links (they open the blob viewer).

| Approach | Where |
|----------|--------|
| **README `<video>` + raw GitHub** | [README](../../README.md#demo) |
| **Demo page** | [docs/demo/index.html](../demo/index.html) → `https://ekale007.github.io/RPAudiobook/demo/` after Pages enabled |

Enable Pages: repo **Settings → Pages → Build from branch `master`, folder `/docs`**.

## Current inventory

| File | Used in README |
|------|----------------|
| `screenshot-library.png` | Library |
| `screenshot-chat.png` | Chat |
| `screenshot-cast.png` | Cast |
| `screenshot-settings.png` | Settings |
| `screenshot-mobile.webp` | Mobile |
| `demo-narrator-en.mp3` | EN narrator demo |
| `demo-multivoice.mp3` | Multi-voice demo |
| `demo-soundscape.mp3` | Soundscape demo |

## Optional additions

| File | Content |
|------|---------|
| `demo-narrator-de.mp3` | German narrator sample |
| `hero-banner.webp` | Wide banner above logo |

## Tips

- **Screenshots:** PNG or WebP, ~1200–1600 px wide; dark theme matches the app.
- **Audio:** MP3, 15–45 s; normalize loudness (~−16 LUFS). `demo-narrator-en.mp3` is large (~21 MB) — consider re-export at 128 kbps if clone size matters.
- After adding files, update README links if filenames differ.
