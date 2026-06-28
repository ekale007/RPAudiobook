import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Willkommen — ${brand.productName}`,
  description:
    "Interaktive RPG-Geschichten im Browser mit KI-Erzähler und natürlicher Sprachausgabe. Open Source, self-hostable, mit DE/EN-Unterstützung.",
  alternates: {
    canonical: "https://rp-audiobook.vercel.app/welcome",
  },
  openGraph: {
    title: `${brand.productName} — Willkommen`,
    description:
      "Interaktive RPG-Geschichten im Browser mit KI-Erzähler und natürlicher Sprachausgabe.",
    url: "https://rp-audiobook.vercel.app/welcome",
  },
};

const features = [
  {
    title: "Du schreibst. Der Erzähler antwortet.",
    body: "Tippe, was dein Charakter tut. Der KI-Narrator führt die Handlung weiter — mit Cast-Dialogen, Atmosphäre und Verzweigungen, die du jederzeit neu werfen kannst.",
    icon: "📖",
  },
  {
    title: "Hörbuch-Modus mit echten Stimmen.",
    body: "ElevenLabs und andere TTS-Provider lesen dir die Szenen vor. Mehrere Stimmen für verschiedene Charaktere, plus Soundscape für SFX und Musik.",
    icon: "🎧",
  },
  {
    title: "Deine Geschichten. Deine Daten.",
    body: "Im Local-Modus bleiben alle Stories in deinem Browser (IndexedDB). Du bringst deine eigenen API-Keys mit (BYOK). Kein Account, kein Tracking, kein Cloud-Zwang.",
    icon: "🔒",
  },
  {
    title: "Bibliothek mit Vorlagen.",
    body: "Starte mit fertigen Templates oder importiere eigene EPUBs. Passe Charaktere, Welten und Lorebücher an. Remixen erlaubt.",
    icon: "📚",
  },
  {
    title: "Open Source. Self-hostable.",
    body: "AGPL-3.0-lizenziert. Du kannst den Code lesen, forken und auf deinem eigenen Server betreiben. Wir glauben an offene Software.",
    icon: "🛠️",
  },
  {
    title: "Multi-Platform. Mobile-first.",
    body: "Funktioniert im Browser, als PWA auf iOS und Android. Erzähle deine Story am Handy mit Kopfhörern — auch im Sperrbildschirm-Modus.",
    icon: "📱",
  },
];

const faqs = [
  {
    q: "Was ist RP Audiobook?",
    a: "Eine Web-App, in der du interaktive Rollenspiel-Geschichten erlebst. Du tippst Aktionen, der KI-Narrator antwortet, und optional wird alles vorgelesen.",
  },
  {
    q: "Brauche ich einen Account?",
    a: "Für den vollen Funktionsumfang ja (Supabase-basierter Login, damit deine Stories synchron bleiben). Du kannst die App aber auch komplett lokal betreiben, ohne Account und ohne Cloud.",
  },
  {
    q: "Was kostet es?",
    a: "In der geschlossenen Beta: nichts. Du brauchst nur einen eigenen OpenRouter-Key (LLM) und optional ElevenLabs (TTS). Wir tragen das Hosting.",
  },
  {
    q: "Wo sind meine Daten?",
    a: "Local-Modus: nur in deinem Browser (IndexedDB). Cloud-Modus: Supabase (Postgres + Storage), EU-Region möglich. Wir verkaufen deine Daten nicht.",
  },
  {
    q: "Kann ich das selbst hosten?",
    a: "Ja. Repo auf GitHub, Next.js-App deployen, Supabase-Projekt anlegen, fertig. Volle Anleitung in den Docs.",
  },
  {
    q: "Voice Cloning — ist das erlaubt?",
    a: "Nein, in den Nutzungsbedingungen ausgeschlossen. Du darfst keine echten Personen imitieren. Fantasy-/Sci-Fi-Stimmen sind okay.",
  },
];

export default function WelcomePage() {
  return (
    <main className="min-h-dvh bg-surface text-zinc-100">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-surface-border">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-950/30 via-surface to-surface" />
        <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
          <div className="text-center">
            <p className="mb-3 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              Geschlossene Beta · Stand Juni 2026
            </p>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-6xl">
              {brand.productName}
            </h1>
            <p className="mb-2 text-2xl font-semibold text-violet-300 sm:text-3xl">
              {brand.tagline}
            </p>
            <p className="mx-auto mb-8 max-w-2xl text-base text-zinc-400 sm:text-lg">
              Du schreibst, was passiert — der KI-Erzähler führt die Handlung
              weiter und liest sie dir vor. Mit echten Stimmen, Atmosphäre und
              einer Bibliothek voller Vorlagen.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent/90 sm:w-auto"
              >
                ▶ Demo anhören
              </Link>
              <Link
                href="/waitlist"
                className="w-full rounded-lg border border-violet-400/40 bg-violet-500/15 px-6 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25 sm:w-auto"
              >
                Auf die Warteliste
              </Link>
              <Link
                href="/login"
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-6 py-3 text-sm font-semibold transition hover:border-zinc-600 sm:w-auto"
              >
                Login mit Invite
              </Link>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Du hast einen Invite? Geh direkt zu{" "}
              <Link href="/login" className="text-accent underline">
                /login
              </Link>
              . Keiner? Trag dich auf der Warteliste ein oder hör dir die Demo
              an.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">
          Was du bekommst
        </h2>
        <p className="mb-10 text-center text-sm text-zinc-400">
          Sechs Dinge, die RP Audiobook von einem normalen Chatbot
          unterscheiden.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-surface-border bg-surface-raised/60 p-5"
            >
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
              <p className="text-sm text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-surface-border bg-surface-raised/30">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
            So läuft&apos;s
          </h2>
          <ol className="space-y-6">
            {[
              {
                n: "1",
                title: "Bibliothek wählen",
                body: "Starte mit einer Vorlage (z. B. »Wenn die Morgendämmerung anbricht«) oder importiere deine eigene EPUB / Charakterkarten.",
              },
              {
                n: "2",
                title: "Protagonist festlegen",
                body: "Lege Name, Hintergrund und ein paar Eigenschaften fest. Der Erzähler passt sich an.",
              },
              {
                n: "3",
                title: "Losspielen mit Kopfhörern",
                body: "Chatte mit dem Erzähler, triff Entscheidungen, höre die Szenen. Rewind, Reroll, Continue — alles auf Tastendruck.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-lg font-bold text-violet-200">
                  {step.n}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{step.title}</h3>
                  <p className="text-sm text-zinc-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">
          Häufige Fragen
        </h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-lg border border-surface-border bg-surface-raised/60 p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold marker:hidden">
                {f.q}
              </summary>
              <p className="mt-2 text-sm text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-surface-border">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">
            Bereit mitzuspielen?
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            Trag dich auf die Warteliste ein oder geh direkt zum Login, wenn
            du schon einen Invite hast.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/waitlist"
              className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black sm:w-auto"
            >
              Auf die Warteliste
            </Link>
            <Link
              href="/login"
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-6 py-3 text-sm font-semibold sm:w-auto"
            >
              Login mit Invite
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row">
          <p>
            © 2026 {brand.productName} · Open Source (AGPL-3.0)
          </p>
          <nav className="flex gap-4">
            <Link href="/legal/impressum" className="hover:text-zinc-300">
              Impressum
            </Link>
            <Link href="/legal/datenschutz" className="hover:text-zinc-300">
              Datenschutz
            </Link>
            <Link
              href="/legal/nutzungsbedingungen"
              className="hover:text-zinc-300"
            >
              Nutzungsbedingungen
            </Link>
            <a
              href="https://github.com/ekale007/RPAudiobook"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
