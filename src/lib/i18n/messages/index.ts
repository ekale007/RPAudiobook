import { deMessages } from "@/lib/i18n/messages/de";
import { enMessages } from "@/lib/i18n/messages/en";
import type { UILocale } from "@/lib/i18n/types";

const MAP = {
  de: deMessages,
  en: enMessages,
} as const;

export function messagesFor(locale: UILocale) {
  return MAP[locale];
}

export type MessageKey = string;

export function translate(
  locale: UILocale,
  key: string,
  vars?: Record<string, string>,
): string {
  const parts = key.split(".");
  let cur: unknown = MAP[locale];
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return key;
    cur = (cur as Record<string, unknown>)[part];
  }
  let text = typeof cur === "string" ? cur : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}
