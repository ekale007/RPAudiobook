import { DEFAULT_UI_LOCALE, type UILocale } from "@/lib/i18n/types";

const STORAGE_KEY = "rp-audiobook.uiLocale";

export function readUiLocale(): UILocale {
  if (typeof window === "undefined") return DEFAULT_UI_LOCALE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim();
    if (raw === "en" || raw === "de") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_UI_LOCALE;
}

export function writeUiLocale(locale: UILocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}
