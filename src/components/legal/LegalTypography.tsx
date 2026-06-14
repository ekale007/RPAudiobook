import type { ReactNode } from "react";

export function LegalH2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-base font-semibold text-zinc-100">{children}</h2>;
}

export function LegalH3({ children }: { children: ReactNode }) {
  return <h3 className="mt-4 text-sm font-medium text-zinc-200">{children}</h3>;
}

export function LegalP({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`mt-2 leading-relaxed ${className}`.trim()}>{children}</p>;
}

export function LegalUl({ children }: { children: ReactNode }) {
  return <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">{children}</ul>;
}

export function LegalOl({ children }: { children: ReactNode }) {
  return <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">{children}</ol>;
}

import { siteLegal } from "@/lib/legal/siteLegal";

export function LegalDisclaimer() {
  return (
    <p className="mt-10 border-t border-surface-border pt-4 text-xs text-zinc-600">
      Diese Texte sind für {siteLegal.productName} erstellt und ersetzen keine individuelle
      Rechtsberatung. Bei geschäftlicher Ausweitung oder Zahlungsverkehr empfiehlt sich eine
      Prüfung durch eine Fachperson (z. B. IT-Recht / Datenschutz).
    </p>
  );
}
