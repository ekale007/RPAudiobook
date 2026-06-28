import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Warteliste — ${brand.productName}`,
  description:
    "Trag dich auf die Warteliste für die RP Audiobook Beta ein. Wir melden uns, sobald ein Platz frei wird.",
  alternates: {
    canonical: "https://rp-audiobook.vercel.app/waitlist",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function WaitlistPage() {
  return (
    <main className="min-h-dvh bg-surface text-zinc-100">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-surface-border bg-surface-raised/60 p-8 text-center">
          <p className="mb-2 text-5xl">📬</p>
          <h1 className="mb-2 text-2xl font-bold">Warteliste</h1>
          <p className="mb-6 text-sm text-zinc-400">
            Die Beta ist aktuell voll. Trag deine E-Mail ein, und wir melden
            uns, sobald ein Platz frei wird.
          </p>

          <form
            action="https://formspree.io/f/xwpozwrq"
            method="POST"
            className="flex flex-col gap-3 text-left"
          >
            <label className="text-sm text-zinc-400" htmlFor="email">
              E-Mail-Adresse
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="du@example.com"
              autoComplete="email"
              className="rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm"
            />

            <label className="mt-2 text-sm text-zinc-400" htmlFor="name">
              Wie sollen wir dich nennen? (optional)
            </label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="Vorname oder Nickname"
              className="rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm"
            />

            <label className="mt-2 flex items-start gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-0.5 shrink-0"
              />
              <span>
                Ich bin damit einverstanden, dass meine E-Mail für die
                Benachrichtigung über einen Beta-Platz gespeichert wird. Wir
                teilen deine Daten nicht.
              </span>
            </label>

            <input
              type="hidden"
              name="_subject"
              value="Neue Wartelisten-Anmeldung — RP Audiobook"
            />
            <input type="hidden" name="_language" value="de" />

            <button
              type="submit"
              className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-black"
            >
              Auf die Warteliste
            </button>
          </form>

          <p className="mt-6 text-xs text-zinc-500">
            Oder direkt{" "}
            <a href="/login" className="text-accent underline">
              mit Invite einloggen
            </a>
            .
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          <a href="/welcome" className="hover:text-zinc-400">
            ← Zurück zur Übersicht
          </a>
        </p>
      </div>
    </main>
  );
}
