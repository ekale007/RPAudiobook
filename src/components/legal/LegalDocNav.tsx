"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import Link from "next/link";

const linkKeys = [
  { href: "/legal/impressum", key: "legal.impressum" },
  { href: "/legal/datenschutz", key: "legal.privacy" },
  { href: "/legal/nutzungsbedingungen", key: "legal.terms" },
] as const;

export function LegalDocNav({
  current,
}: {
  current: (typeof linkKeys)[number]["href"];
}) {
  const { t } = useUiLocale();

  return (
    <nav
      className="mb-6 flex flex-wrap gap-2 border-b border-surface-border pb-4 text-xs"
      aria-label={t("legal.navAria")}
    >
      {linkKeys.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={
            l.href === current
              ? "rounded-lg bg-accent/15 px-2.5 py-1 font-medium text-accent"
              : "rounded-lg px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
          }
        >
          {t(l.key)}
        </Link>
      ))}
    </nav>
  );
}
