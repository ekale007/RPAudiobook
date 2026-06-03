import Link from "next/link";
import type { ReactNode } from "react";

export function AppHeader({
  title,
  backHref,
  centerSlot,
}: {
  title: string;
  backHref?: string;
  centerSlot?: ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-surface-border bg-surface/95 backdrop-blur">
      <div className="relative flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {backHref ? (
            <Link
              href={backHref}
              className="shrink-0 text-sm text-accent"
              aria-label="Back"
            >
              ←
            </Link>
          ) : null}
          <h1 className="min-w-0 truncate text-sm font-semibold sm:text-base">
            {title}
          </h1>
        </div>

        {centerSlot ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[55%] -translate-x-1/2 -translate-y-1/2 sm:max-w-none">
            <div className="pointer-events-auto">{centerSlot}</div>
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-end gap-3">
          <Link
            href="/account"
            className="shrink-0 text-xs text-zinc-400 sm:text-sm"
          >
            Account
          </Link>
          <Link
            href="/settings"
            className="shrink-0 text-xs text-zinc-400 sm:text-sm"
          >
            Settings
          </Link>
        </div>
      </div>
    </header>
  );
}
