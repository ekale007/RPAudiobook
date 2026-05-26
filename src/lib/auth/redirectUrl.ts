const OVERRIDE_KEY = "hoerbuchki.authRedirectOrigin";

/** Path after email link is exchanged (password recovery). */
export const PASSWORD_UPDATE_PATH = "/auth/update-password";

/** Origin used for auth email redirects (must match Supabase allow list). */
export function getAuthRedirectOrigin(): string {
  if (typeof window === "undefined") return "";

  const override = localStorage.getItem(OVERRIDE_KEY)?.trim();
  if (override) {
    try {
      const u = new URL(override);
      return u.origin;
    } catch {
      /* ignore invalid */
    }
  }

  return window.location.origin;
}

export function getAuthCallbackUrl(next = "/"): string {
  const origin = getAuthRedirectOrigin();
  const base = `${origin}/auth/callback`;
  if (!next || next === "/") return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

export function getPasswordResetRedirectUrl(): string {
  return getAuthCallbackUrl(PASSWORD_UPDATE_PATH);
}

export function loadRedirectOriginOverride(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(OVERRIDE_KEY) ?? "";
}

export function saveRedirectOriginOverride(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) {
    localStorage.removeItem(OVERRIDE_KEY);
    return;
  }
  const normalized = trimmed.replace(/\/$/, "");
  localStorage.setItem(OVERRIDE_KEY, normalized);
}

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}
