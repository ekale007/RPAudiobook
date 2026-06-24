import { translate } from "@/lib/i18n/messages";
import { DEFAULT_UI_LOCALE, type UILocale } from "@/lib/i18n/types";

export function formatAuthError(
  err: unknown,
  locale: UILocale = DEFAULT_UI_LOCALE,
): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);

  if (/rate limit/i.test(msg)) {
    return translate(locale, "authErrors.rateLimit");
  }

  if (/invalid login credentials/i.test(msg)) {
    return translate(locale, "authErrors.invalidCredentials");
  }

  if (/email not confirmed/i.test(msg)) {
    return translate(locale, "authErrors.emailNotConfirmed");
  }

  if (/signups? not allowed/i.test(msg)) {
    return translate(locale, "authErrors.signupsNotAllowed");
  }

  return msg;
}
