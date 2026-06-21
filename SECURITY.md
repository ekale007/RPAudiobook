# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` branch | yes |
| Older tags | best effort |

## Reporting a vulnerability

**Please do not open public GitHub issues for security problems.**

1. Use [GitHub private security advisories](https://github.com/ekale007/RPAudiobook/security/advisories/new) if available, or
2. Contact the maintainers through the channel listed in the repository profile.

We aim to acknowledge reports within **72 hours** and provide a fix or mitigation plan as soon as practicable.

## Scope

This project is intended primarily as **local-first software** (run on your own machine). A publicly hosted SaaS deployment is optional and maintained separately by the operator.

In scope:

- Authentication, authorization, and billing flows (SaaS mode)
- Server-side API routes that proxy to LLM/TTS providers
- Supabase Row Level Security assumptions
- Client-side storage of user API keys (local mode)

Out of scope (unless they affect the core app):

- Third-party services (OpenRouter, ElevenLabs, Fish Audio, Stripe, Supabase, Vercel)
- Self-hosted TTS/LLM binaries you run locally (Kokoro, edge-tts, Ollama, etc.)

## Deployment notes

### Local-first mode (default without Supabase env)

- Stories and API keys stay on the client (IndexedDB / localStorage).
- No server-side account is required.
- You are responsible for keys you paste into Settings and for network access to providers you configure.

### SaaS mode (Supabase + server env keys)

- Never commit `.env` or `.env.local`.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, and provider API keys **server-only** (Vercel/host env, not `NEXT_PUBLIC_*`).
- Restrict `/admin` via `ADMIN_USER_IDS`.

### Local TTS proxy (`POST /api/tts/local`)

This route forwards synthesis requests to a TTS daemon on the same machine or private LAN. Upstream URLs are restricted to **localhost and RFC1918 private addresses** to reduce SSRF risk when the Next.js server is reachable from a network.

Do not expose a dev server bound to `0.0.0.0` on an untrusted network without understanding that local TTS ports may also be reachable.

## Secrets checklist (operators)

- [ ] `.env.local` is gitignored and not in the repo
- [ ] No API keys in client bundles except user-supplied keys in local mode
- [ ] `ADMIN_USER_IDS` set for any public SaaS deployment
- [ ] Stripe webhook secret configured for billing routes
- [ ] Supabase RLS enabled on all user tables

## License

See [LICENSE](./LICENSE) (AGPL-3.0-or-later).
