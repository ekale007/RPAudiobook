# OAuth login (Google, GitHub, …)

Social sign-in uses **Supabase Auth** OAuth providers. The app shows buttons on `/login` and `/signup`; after the provider redirect, `/auth/callback` exchanges the code for a session (same flow as password reset).

## App configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `NEXT_PUBLIC_OAUTH_PROVIDERS` | `google,github,discord` | Comma-separated list of enabled buttons |

Supported values: `google`, `github`, `discord`, `apple`, `azure` (Microsoft).

Examples:

```env
# Default trio
NEXT_PUBLIC_OAUTH_PROVIDERS=google,github,discord

# Add Apple + Microsoft
NEXT_PUBLIC_OAUTH_PROVIDERS=google,github,discord,apple,azure

# Hide OAuth until configured in Supabase
NEXT_PUBLIC_OAUTH_PROVIDERS=
```

Set on **Vercel** → Environment Variables → redeploy.

## Supabase (required per provider)

**Authentication → URL Configuration** — same as email auth:

- **Site URL**: your production URL
- **Redirect URLs**: `https://<your-domain>/auth/callback`, `http://localhost:3000/auth/callback`

**Authentication → Providers** — enable each provider you want and paste client ID / secret from the vendor:

| Provider | Where to create credentials | Effort |
|----------|----------------------------|--------|
| **Google** | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth client (Web). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` | Low |
| **GitHub** | GitHub → Settings → Developer settings → OAuth Apps. Authorization callback URL: `https://<project-ref>.supabase.co/auth/v1/callback` | Low |
| **Discord** | [Discord Developer Portal](https://discord.com/developers/applications) → OAuth2 → Redirects: Supabase callback URL | Low |
| **Apple** | Apple Developer → Sign in with Apple → Services ID + key | Medium |
| **Azure** (Microsoft) | Azure Portal → App registrations → Redirect URI: Supabase callback | Medium |

The **Supabase callback URL** is shown in the provider settings panel in the Supabase dashboard (copy it exactly).

## Invite-only beta

If **Allow new users to sign up** is OFF in Supabase, OAuth can only sign in **existing** users. New OAuth accounts get “Signups not allowed” — invite users first or use open sign-up.

## Local dev

OAuth redirect uses `window.location.origin` (or the saved “App URL” override on the reset form). Add `http://localhost:3000/auth/callback` to Supabase redirect URLs. For phone LAN testing, add `http://192.168.x.x:3000/auth/callback` too.

See also: [AUTH.md](./AUTH.md), [BETA-AUTH.md](./BETA-AUTH.md)
