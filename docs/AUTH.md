# Authentication (Supabase)

## Password login (default)

1. Supabase → **Authentication** → **Providers** → **Email** → enabled.
2. For solo dev: turn off **Confirm email** (faster sign-up).
3. In the app: **Login** → email + password → **Sign in** or **Create account**.

Works on phone at `http://<PC-IP>:3000` without opening email for every visit.

## Forgot password

1. **Login** → **Forgot password?**
2. Enter email → **Send reset link**
3. Open the email on the **same device** you use for the app.
4. Set a new password on the **New password** screen.

**Supabase setup:**

- **URL Configuration** → add redirect URLs, e.g.  
  `http://localhost:3000/auth/callback`  
  `http://192.168.x.x:3000/auth/callback`
- **Email templates** → “Reset password” should use `{{ .ConfirmationURL }}` (default).

On phone: set **App URL** on the forgot-password form to `http://<PC-IP>:3000` so the email link returns to your LAN dev server.

## Email rate limits

Free Supabase plans allow only a few auth emails per hour (reset + confirm combined). If you hit the limit, wait ~1 hour or add **custom SMTP** (Resend, SendGrid, etc.).

## Anonymous (quick dev test)

1. Supabase → **Authentication** → **Providers** → **Anonymous** → ON.
2. App → **Dev: continue without email**.

Stories are tied to the anonymous user until you link a real account (not implemented yet).

## Mobile

Use password sign-in daily. Password reset needs one email per recovery.
