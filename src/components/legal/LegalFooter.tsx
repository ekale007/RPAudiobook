"use client";

import { brand } from "@/lib/brand";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import Link from "next/link";

const linkKeys = [
  { href: "/legal/impressum", key: "legal.impressum" },
  { href: "/legal/datenschutz", key: "legal.privacy" },
  { href: "/legal/nutzungsbedingungen", key: "legal.terms" },
] as const;

export function LegalFooter({ className = "" }: { className?: string }) {
  const { t } = useUiLocale();

  return (
    <footer
      className={`safe-bottom border-t border-surface-border px-4 py-4 text-center text-xs text-zinc-500 ${className}`}
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {linkKeys.map((l) => (
          <Link key={l.href} href={l.href} className="text-zinc-400 hover:text-accent">
            {t(l.key)}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-zinc-600">
        © {new Date().getFullYear()} {brand.productName}
      </p>
    </footer>
  );
}
