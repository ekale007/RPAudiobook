# Contributing to RP Audiobook

Thank you for your interest in contributing. This project is licensed under **AGPL-3.0-or-later** — by contributing, you agree that your contributions will be licensed under the same terms.

## Getting started

1. Fork and clone the repository.
2. Copy `.env.example` to `.env.local` (optional for local-first; omit Supabase vars to run without login).
3. `npm install`
4. **Local-first (recommended for OSS):** `npm run start:local` or `npm run dev`
5. Read [docs/LOCAL-FIRST.md](docs/LOCAL-FIRST.md) and [docs/README.md](docs/README.md).

## Development

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run start:local` | Kokoro + Next (Windows) |

## Pull requests

1. Keep changes focused — one logical change per PR when possible.
2. Match existing code style and conventions in surrounding files.
3. Do **not** commit secrets, `.env.local`, or personal legal/contact data.
4. Update docs when behavior or env vars change.
5. Ensure `npm run build` passes before requesting review.

## Content & legal

- Library templates and bundled assets must be **original or properly licensed** for redistribution.
- See [docs/BETA-CONTENT-LEGAL.md](docs/BETA-CONTENT-LEGAL.md) before adding public library entries.
- Do not include real people's voices, private data, or third-party copyrighted worlds without rights.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Questions

Open a GitHub Discussion or issue for bugs and feature ideas. For architecture context, start with [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md).
