# Mobile (PWA) testing

## On the same Wi‑Fi

1. On PC: `npm run dev` (listens on `0.0.0.0:3000`)
2. Find PC IP: `ipconfig` → IPv4 (e.g. `192.168.1.42`)
3. On phone browser: `http://192.168.1.42:3000` (not localhost)
4. **Add to Home Screen** (Safari/Chrome) for app-like UI

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
