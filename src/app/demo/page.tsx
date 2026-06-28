import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Demo — ${brand.productName}`,
  description:
    "Sieh RP Audiobook in Aktion: 60-Sekunden-Video-Tour, Audio-Samples aus echten Sessions und Chat-Beispiele. Hör dir an, wie interaktive RPG-Stories klingen.",
  alternates: {
    canonical: "https://rp-audiobook.vercel.app/demo",
  },
  openGraph: {
    title: `${brand.productName} — Demo`,
    description:
      "Video-Tour, Audio-Samples und Chat-Beispiele. Hör dir an, wie interaktive RPG-Stories klingen.",
    url: "https://rp-audiobook.vercel.app/demo",
  },
};

// Audio samples (already in the repo at docs/assets/readme/)
const audioSamples = [
  {
    id: "narrator-en",
    title: "EN — Narrator",
    description:
      "Eine kurze Szene mit der Standard-Erzähler-Stimme. Ideal zum Reinhören, ob die Qualität für dich passt.",
    src: "/demo-audio/demo-narrator-en.mp3",
    lang: "en",
  },
  {
    id: "multivoice",
    title: "Multi-Voice Cast",
    description:
      "Drei Figuren mit unterschiedlichen Stimmen im selben Stück. So klingt RP Audiobook, wenn der Cast verschiedene Rollen spricht.",
    src: "/demo-audio/demo-multivoice.mp3",
    lang: "de",
  },
  {
    id: "soundscape",
    title: "Soundscape + Stimme",
    description:
      "Erzähler + SFX-Schicht (Regen-Loop im Hintergrund). Zeigt, wie die App Atmosphäre baut.",
    src: "/demo-audio/demo-soundscape.mp3",
    lang: "de",
  },
];

// Mock chat snippet (so visitors can read what a real session looks like)
const chatSnippet = [
  {
    role: "user" as const,
    text: "Ich schaue mich im Raum um. Die Petroleumlampe wirft zitternde Schatten an die Wand.",
  },
  {
    role: "assistant" as const,
    speaker: "Erzähler",
    text: "Der Raum ist kleiner, als du gedacht hattest. Die Wände sind aus grobem Stein, kalt und feucht. In der Ecke steht ein wackeliger Stuhl, daneben ein Tisch mit einer zugedeckten Schale. Ein Luftzug streift deinen Nacken — aber es gibt kein offenes Fenster.",
  },
  {
    role: "user" as const,
    text: "Ich gehe zur Schale und hebe den Deckel.",
  },
  {
    role: "assistant" as const,
    speaker: "Erzähler",
    text: "Du hebst den Deckel. Darin liegt ein einzelner, schwarzer Schlüssel. Kalt. Schwerer als er aussieht. Als du ihn berührst, spürst du ein Kribbeln in deinen Fingerspitzen — und für einen Herzschlag flackert die Lampe.",
  },
  {
    role: "user" as const,
    text: "Ich nehme den Schlüssel und stecke ihn ein.",
  },
  {
    role: "assistant" as const,
    speaker: "Lyra (im Kopf)",
    text: "(flüsternd) Lass ihn liegen. Wir wissen nicht, wofür er ist.",
  },
];

export default function DemoPage() {
  return (
    <main className="min-h-dvh bg-surface text-zinc-100">
      {/* Hero */}
      <section className="border-b border-surface-border">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:py-14">
          <p className="mb-2 text-xs uppercase tracking-wider text-violet-300">
            Live-Demo
          </p>
          <h1 className="mb-3 text-3xl font-bold sm:text-5xl">
            Hör dir RP Audiobook an
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-zinc-400 sm:text-base">
            60-Sekunden-Video, drei Audio-Samples aus echten Sessions und ein
            Chat-Beispiel. Überzeuge dich selbst, bevor du dich auf die
            Warteliste setzt.
          </p>
        </div>
      </section>

      {/* Video Tour — iPhone recording */}
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h2 className="mb-2 text-xl font-bold sm:text-2xl">
          📱 Video-Tour (60 Sekunden)
        </h2>
        <p className="mb-5 text-sm text-zinc-400">
          Aufgenommen auf einem iPhone — Login, Bibliothek, Chat mit
          TTS-Autoplay, Mobile PWA.
        </p>

        {/* Video placeholder — when video is uploaded, swap this div for a <video> */}
        <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised/60">
          <div className="relative aspect-video w-full bg-gradient-to-br from-violet-950/40 via-surface to-surface">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <div className="text-5xl">🎬</div>
              <p className="px-4 text-sm text-zinc-300">
                Video wird hochgeladen, sobald die Aufnahme fertig ist.
              </p>
              <p className="px-4 text-xs text-zinc-500">
                Empfohlen: iPhone-Bildschirmaufnahme in Querformat, 60-90 Sek,
                mit Kopfhörer-Audio.
              </p>
            </div>
          </div>
        </div>

        <details className="mt-4 rounded-lg border border-surface-border bg-surface-raised/40 p-4 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-300">
            Aufnahme-Anleitung
          </summary>
          <ol className="mt-3 space-y-2 text-zinc-400">
            <li>
              <strong className="text-zinc-200">1. iPhone vorbereiten:</strong>{" "}
              Einstellungen → Kontrollzentrum → Bildschirmaufnahme hinzufügen.
            </li>
            <li>
              <strong className="text-zinc-200">2. Nicht stören + Wischen
              ausschalten</strong> damit nichts die Aufnahme unterbricht.
            </li>
            <li>
              <strong className="text-zinc-200">3. Querformat</strong>{" "}
              (iPhone drehen) — sieht auf YouTube/Social besser aus.
            </li>
            <li>
              <strong className="text-zinc-200">4. Kopfhörer mit Kabel</strong>{" "}
              verwenden — bessere Audio-Qualität beim Dreh.
            </li>
            <li>
              <strong className="text-zinc-200">5. Demo-Skript</strong>{" "}
              abspulen: Login → Bibliothek → Story öffnen → 2-3 Chat-Turns
              → TTS-Autoplay zeigen → Sperrbildschirm-Modus.
            </li>
            <li>
              <strong className="text-zinc-200">6. Upload:</strong> Datei nach{" "}
              <code className="rounded bg-surface px-1 py-0.5 text-xs">
                public/demo/
              </code>{" "}
              legen (z.B.{" "}
              <code className="rounded bg-surface px-1 py-0.5 text-xs">
                public/demo/tour.mp4
              </code>
              ) und oben einbauen.
            </li>
          </ol>
        </details>
      </section>

      {/* Audio samples */}
      <section className="border-y border-surface-border bg-surface-raised/30">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <h2 className="mb-2 text-xl font-bold sm:text-2xl">
            🎧 Audio-Samples
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            Aus echten RP-Audiobook-Sessions. Jeder Clip ist 15-30 Sekunden
            lang.
          </p>
          <div className="space-y-3">
            {audioSamples.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-surface-border bg-surface p-4"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{s.title}</h3>
                  <span className="rounded-full border border-surface-border bg-surface-raised/60 px-2 py-0.5 text-[10px] uppercase text-zinc-500">
                    {s.lang}
                  </span>
                </div>
                <p className="mb-3 text-sm text-zinc-400">{s.description}</p>
                <audio
                  controls
                  preload="metadata"
                  src={s.src}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chat snippet — text-only preview of what a session looks like */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="mb-2 text-xl font-bold sm:text-2xl">
          💬 So sieht ein Chat aus
          <span className="ml-2 text-sm font-normal text-zinc-500">
            (Text-Vorschau)
          </span>
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          Eine kurze Szene aus der Vorlage &raquo;Wenn die Morgendämmerung
          anbricht&laquo;. Im echten Spiel wird alles vorgelesen.
        </p>

        <div className="space-y-3 rounded-2xl border border-surface-border bg-surface-raised/40 p-5">
          {chatSnippet.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "flex justify-end"
                  : "flex flex-col items-start"
              }
            >
              {msg.role === "assistant" && msg.speaker ? (
                <span className="mb-1 ml-1 text-[10px] uppercase tracking-wider text-violet-300">
                  {msg.speaker}
                </span>
              ) : null}
              <div
                className={
                  msg.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/15 px-3 py-2 text-sm"
                    : "max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-raised px-3 py-2 text-sm text-zinc-200"
                }
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          &raquo;Lyra&laquo; ist eine innere Stimme — in der App bekommt sie
          eine eigene TTS-Stimme, sodass du sie vom Erzähler unterscheiden
          kannst.
        </p>
      </section>

      {/* CTA */}
      <section className="border-t border-surface-border">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-14">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">
            Überzeugt? Auf die Warteliste.
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            Wir öffnen die Beta schrittweise. Trag dich ein, dann melden wir
            uns, sobald ein Platz frei wird.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/waitlist"
              className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black sm:w-auto"
            >
              Auf die Warteliste
            </Link>
            <Link
              href="/welcome"
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-6 py-3 text-sm font-semibold sm:w-auto"
            >
              Mehr über das Projekt
            </Link>
            <a
              href="https://github.com/ekale007/RPAudiobook"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-6 py-3 text-sm font-semibold sm:w-auto"
            >
              Code auf GitHub ansehen
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
