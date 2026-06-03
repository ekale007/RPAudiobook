import Link from "next/link";

const links = [
  { href: "/legal/impressum", label: "Impressum" },
  { href: "/legal/datenschutz", label: "Datenschutz" },
  { href: "/legal/nutzungsbedingungen", label: "Nutzungsbedingungen" },
] as const;

export function LegalDocNav({ current }: { current: (typeof links)[number]["href"] }) {
  return (
    <nav
      className="mb-6 flex flex-wrap gap-2 border-b border-surface-border pb-4 text-xs"
      aria-label="Rechtliche Informationen"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={
            l.href === current
              ? "rounded-lg bg-accent/15 px-2.5 py-1 font-medium text-accent"
              : "rounded-lg px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
