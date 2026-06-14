import { brand } from "@/lib/brand";
import Link from "next/link";

const links = [
  { href: "/legal/impressum", label: "Impressum" },
  { href: "/legal/datenschutz", label: "Datenschutz" },
  { href: "/legal/nutzungsbedingungen", label: "Nutzungsbedingungen" },
] as const;

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`safe-bottom border-t border-surface-border px-4 py-4 text-center text-xs text-zinc-500 ${className}`}
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-zinc-400 hover:text-accent">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-zinc-600">
        © {new Date().getFullYear()} {brand.productName}
      </p>
    </footer>
  );
}
