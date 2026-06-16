# Mobile (PWA) testing

## Install hint (in-app)

On phones, a banner appears when the app is not yet installed:

- **Android (Chrome):** tap **Install** when the browser offers the PWA prompt.
- **iOS (Safari):** tap **Share** → **Add to Home Screen** (Apple does not allow a one-tap install button).

Dismiss with **Not now** — the hint stays hidden for 14 days. In standalone mode (already on the home screen), the banner does not show.

Icons and `manifest.webmanifest` use `/brand/logo.png` (192 / 512, maskable).

## On the same Wi‑Fi

1. On PC: `npm run dev` (listens on `0.0.0.0:3000`)
2. Find PC IP: `ipconfig` → IPv4 (e.g. `192.168.1.42`)
3. On phone browser: `http://192.168.1.42:3000` (not localhost)
4. **Add to Home Screen** (Safari/Chrome) for app-like UI — or use the in-app install banner (see [MOBILE.md](MOBILE.md)).

## Mobile QA checklist (local or prod)

- [ ] Install banner: Android shows **Install**; iOS shows Safari steps
- [ ] Banner hidden after dismiss; hidden in standalone / home-screen mode
- [ ] Safe areas: header and chat input not under notch / home indicator
- [ ] Chat scroll and keyboard: input stays visible while typing
- [ ] TTS play/pause usable with one thumb
- [ ] Landscape: layout does not break (library carousel, chat)

## Login on phone

1. Open `http://192.168.x.x:3000/login` on the phone.
2. **Create account** (once) → **Sign in** with password.
3. No email needed for daily use if “Confirm email” is off in Supabase.

**Forgot password:** use **Forgot password?** on the login page. Set **App URL** to `http://192.168.x.x:3000` so the reset email opens on your phone. Add that URL in Supabase → **URL Configuration** → **Redirect URLs** (see [AUTH.md](AUTH.md)).

## TTS on phone

- Chat + cloud save work on the phone.
- **Listen** needs the TTS server on the PC: `npm run tts:server`
- The phone cannot run edge-tts directly in the browser.

## Tips

- Use **Story hub** (tap story title) for chapters and export.
- Closed chapters are **read-only**; continue play on the **Active** chapter.
- API keys (OpenRouter) are per-browser — set them once on the phone if you only use the phone.
