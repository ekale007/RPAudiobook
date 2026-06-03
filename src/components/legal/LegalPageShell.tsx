import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalFooter } from "@/components/legal/LegalFooter";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={title} backHref="/" />
      <article className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 text-sm leading-relaxed text-zinc-300">
        {children}
      </article>
      <LegalFooter />
    </main>
  );
}
