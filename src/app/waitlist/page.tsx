"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("https://formspree.io/f/mlgynzga", {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        setStatus("success");
        form.reset();
      } else {
        const body = await res.json().catch(() => ({}));
        const msg =
          body?.error ||
          body?.errors?.map((x: { message: string }) => x.message).join(", ") ||
          "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
        setErrorMsg(msg);
        setStatus("error");
      }
    } catch (err) {
      setErrorMsg("Netzwerkfehler. Bitte prüfe deine Verbindung.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-dvh bg-surface text-zinc-100">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-surface-border bg-surface-raised/60 p-8">
          {status === "success" ? (
            <div className="text-center">
              <p className="mb-2 text-5xl">✅</p>
              <h1 className="mb-2 text-2xl font-bold">Du bist auf der Liste!</h1>
              <p className="mb-6 text-sm text-zinc-400">
                Wir melden uns bei dir, sobald ein Beta-Platz frei wird.
                In der Zwischenzeit kannst du dir das Projekt auf{" "}
                <a
                  href="https://github.com/ekale007/RPAudiobook"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  GitHub
                </a>{" "}
                anschauen.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link
                  href="/welcome"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black"
                >
                  Zur Übersicht
                </Link>
                <Link
                  href="/"
                  className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-semibold"
                >
                  Zur Startseite
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="mb-2 text-5xl">📬</p>
                <h1 className="mb-2 text-2xl font-bold">Warteliste</h1>
                <p className="mb-6 text-sm text-zinc-400">
                  Die Beta ist aktuell voll. Trag deine E-Mail ein, und wir
                  melden uns, sobald ein Platz frei wird.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
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
                  disabled={status === "submitting"}
                  className="rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm disabled:opacity-50"
                />

                <label className="mt-2 text-sm text-zinc-400" htmlFor="name">
                  Wie sollen wir dich nennen? (optional)
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="Vorname oder Nickname"
                  disabled={status === "submitting"}
                  className="rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm disabled:opacity-50"
                />

                <label className="mt-2 flex items-start gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    disabled={status === "submitting"}
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
                  value={`Neue Wartelisten-Anmeldung — ${brand.productName}`}
                />
                <input type="hidden" name="_language" value="de" />
                {/* Honeypot gegen Spam-Bots */}
                <input
                  type="text"
                  name="_gotcha"
                  tabIndex={-1}
                  autoComplete="off"
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                />

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition disabled:opacity-50"
                >
                  {status === "submitting"
                    ? "Wird gesendet…"
                    : "Auf die Warteliste"}
                </button>

                {status === "error" && (
                  <p
                    role="alert"
                    className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
                  >
                    {errorMsg}
                  </p>
                )}
              </form>

              <p className="mt-6 text-center text-xs text-zinc-500">
                Oder direkt{" "}
                <Link href="/login" className="text-accent underline">
                  mit Invite einloggen
                </Link>
                .
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          <Link href="/welcome" className="hover:text-zinc-400">
            ← Zurück zur Übersicht
          </Link>
        </p>
      </div>
    </main>
  );
}
