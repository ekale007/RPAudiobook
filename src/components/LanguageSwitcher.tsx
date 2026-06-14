"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import type { UILocale } from "@/lib/i18n/types";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useUiLocale();

  const btn = (code: UILocale, label: string) => (
    <button
      key={code}
      type="button"
      onClick={() => setLocale(code)}
      aria-pressed={locale === code}
      className={`rounded-md px-2 py-1 text-[10px] font-medium sm:text-xs ${
        locale === code
          ? "bg-accent/20 text-accent"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 rounded-lg border border-surface-border bg-surface/60 p-0.5">
        {btn("de", "DE")}
        {btn("en", "EN")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-zinc-500">{t("lang.label")}</span>
      <div className="flex gap-1 rounded-lg border border-surface-border bg-surface/60 p-0.5">
        {btn("de", t("lang.de"))}
        {btn("en", t("lang.en"))}
      </div>
    </div>
  );
}
