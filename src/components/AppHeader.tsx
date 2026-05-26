import Link from "next/link";

export function AppHeader({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-surface-border bg-surface/95 px-4 py-3 backdrop-blur">
      {backHref ? (
        <Link
          href={backHref}
          className="text-sm text-accent"
          aria-label="Back"
        >
          ←
        </Link>
      ) : null}
      <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
      <Link href="/settings" className="text-sm text-zinc-400">
        Settings
      </Link>
    </header>
  );
}
