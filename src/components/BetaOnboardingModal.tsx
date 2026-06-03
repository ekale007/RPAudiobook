"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OverlayPanel } from "@/components/ui/OverlayPanel";

const STORAGE_KEY = "hoerbuchki_onboarding_v1";

export function BetaOnboardingModal({ openGate }: { openGate: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!openGate) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [openGate]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <OverlayPanel
      open={open}
      onClose={dismiss}
      title="Willkommen in der Beta"
      wide
    >
      <p className="mb-4 text-sm text-zinc-400">
        Kurz die wichtigsten Schritte — danach kannst du direkt loslegen.
      </p>
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
        <li>
          <strong className="text-zinc-200">Bibliothek:</strong> Vorlage wählen,
          Protagonist und Stimme festlegen.
        </li>
        <li>
          <strong className="text-zinc-200">Chat:</strong> Geschichte schreiben;
          Kopfhörer für TTS. Eingabe unten aufklappen für Say & Reaktionen.
        </li>
        <li>
          <strong className="text-zinc-200">Story-Hub:</strong> Cast für Stimmen,
          Gedächtnis & Welt bearbeiten.
        </li>
      </ol>
      <p className="mb-4 text-xs text-zinc-500">
        KI-Antworten und Sprache werden über Drittanbieter erzeugt (OpenRouter,
        TTS). Limits siehst du unter Account. Nur Inhalte nutzen, für die du Rechte
        hast. Betreiber: Eyüp Kale.
      </p>
      <p className="mb-4 text-xs text-zinc-500">
        <Link href="/legal/datenschutz" className="text-accent underline">
          Datenschutz
        </Link>
        {" · "}
        <Link href="/legal/nutzungsbedingungen" className="text-accent underline">
          Nutzungsbedingungen
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950"
      >
        Verstanden — los geht&apos;s
      </button>
    </OverlayPanel>
  );
}
