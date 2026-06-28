"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { brand } from "@/lib/brand";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { isLocalMode } from "@/lib/deploymentMode";
import { isInviteOnlyBeta } from "@/lib/auth/betaAuth";

export function AppHeader({
  title,
  backHref,
  centerSlot,
  showBrand = false,
}: {
  title: string;
  backHref?: string;
  centerSlot?: ReactNode;
  showBrand?: boolean;
}) {
  const { t } = useUiLocale();

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-surface-border/80 bg-surface/90 backdrop-blur-md">
      <div className="relative mx-auto flex max-w-3xl items-center gap-2 px-2.5 py-2 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {backHref ? (
            <Link
              href={backHref}
              className="touch-target flex shrink-0 items-center justify-center text-sm text-accent"
              aria-label={t("nav.back")}
            >
              ←
            </Link>
          ) : null}
          {showBrand ? (
            <Link href="/" className="flex min-w-0 items-center gap-1.5">
              <Image
                src={brand.logoSrc}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 rounded-md bg-white/95 object-contain p-0.5"
                priority
              />
              <span className="min-w-0 truncate text-sm font-semibold tracking-tight">
                {brand.productName}
              </span>
            </Link>
          ) : (
            <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">
              {title}
            </h1>
          )}
        </div>

        {centerSlot ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[50%] -translate-x-1/2 -translate-y-1/2">
            <div className="pointer-events-auto">{centerSlot}</div>
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <LanguageSwitcher compact />
          {isInviteOnlyBeta() ? (
            <Link
              href="/waitlist"
              className="shrink-0 rounded-md border border-violet-400/40 bg-violet-500/15 px-2 py-1 text-[10px] font-medium text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25 sm:text-xs"
              aria-label="Auf die Warteliste"
            >
              <span className="hidden sm:inline">Warteliste</span>
              <span className="sm:hidden">β+</span>
            </Link>
          ) : null}
          {!isLocalMode() ? (
            <Link
              href="/account"
              className="shrink-0 text-[10px] font-medium text-zinc-500 transition hover:text-zinc-300 sm:text-xs"
            >
              {t("nav.account")}
            </Link>
          ) : null}
          <Link
            href="/settings"
            className="shrink-0 text-[10px] font-medium text-zinc-500 transition hover:text-zinc-300 sm:text-xs"
          >
            {t("nav.settings")}
          </Link>
        </div>
      </div>
    </header>
  );
}
