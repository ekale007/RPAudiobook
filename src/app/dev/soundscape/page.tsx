"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { resolveTurnSound } from "@/lib/audio/soundscape";
import {
  playSfx,
  playTurnSoundscape,
  stopAllSfx,
} from "@/lib/audio/sfxPlayer";
import { SFX_CATALOG } from "@/lib/audio/sfxCatalog";
import type { StoryPlotState } from "@/lib/memory/plotState";

function plot(partial: Partial<StoryPlotState>): StoryPlotState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    timeLabel: "",
    location: "",
    presentCharacters: [],
    absentCharacters: [],
    scheduledEvents: [],
    threats: [],
    resolvedFacts: [],
    openThreads: [],
    publicKnowledge: [],
    ...partial,
  };
}

const SAMPLES = [
  {
    label: "Spannung + Regen + Tür",
    text: 'Der Sturm tobt. <<music:tension>> <<sfx:rain>> <<sfx:door>>',
    plot: plot({
      location: "verlassener Turm im Regen",
      timeLabel: "Mitternacht",
      openThreads: ["Geheimnis im Keller"],
      threats: [
        { id: "chase", label: "Verfolger", status: "active", detail: "nah" },
      ],
    }),
  },
  {
    label: "Ruhig (Plot: Gasthaus)",
    text: "Am Kamin sitzt du still.",
    plot: plot({
      location: "gemütliches Gasthaus am Kamin",
      timeLabel: "Abend",
    }),
  },
  {
    label: "Mystisch (Plot)",
    text: "Nebel zieht durch den Friedhof.",
    plot: plot({
      location: "Friedhof im Nebel",
      timeLabel: "Nacht",
      openThreads: ["Flüstern in den Schatten"],
    }),
  },
];

export default function SoundscapeDevPage() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const push = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${line}`, ...prev].slice(0, 12));
  }, []);

  const playResolved = async (sample: (typeof SAMPLES)[number]) => {
    setBusy(true);
    try {
      await stopAllSfx();
      const resolved = resolveTurnSound({
        rawContent: sample.text,
        storySettings: {
          recentTurnCount: 24,
          loreTokenBudget: 3500,
          plotState: sample.plot,
          qwenSceneInstructEnabled: true,
        },
      });
      push(
        `▶ ${sample.label}: ambient=[${resolved.ambient.join(", ")}] music=${resolved.music ?? "—"} shots=[${resolved.oneShots.join(", ")}]`,
      );
      await playTurnSoundscape(resolved);
    } catch (e) {
      push(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const playId = async (id: string) => {
    setBusy(true);
    try {
      push(`▶ Einzel: ${id}`);
      await playSfx(id);
    } catch (e) {
      push(`Fehler ${id}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg p-4 text-zinc-200">
      <p className="mb-4 text-sm text-zinc-500">
        <Link href="/" className="text-accent underline">
          ← Start
        </Link>
        {" · "}Soundscape-Test (Web Audio, Kopfhörer empfohlen)
      </p>
      <h1 className="mb-2 text-lg font-medium text-accent">SFX / Musik Test</h1>

      <section className="mb-4 flex flex-col gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={busy}
            onClick={() => void playResolved(s)}
            className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-left text-sm disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xs font-medium text-zinc-400">Einzel-Assets</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SFX_CATALOG).map((id) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => void playId(id)}
              className="rounded border border-surface-border px-2 py-1 text-[10px] disabled:opacity-50"
            >
              {id}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void stopAllSfx();
          push("⏹ Loops gestoppt");
        }}
        className="mb-4 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs"
      >
        Alle Loops stoppen
      </button>

      <ul className="space-y-1 text-[10px] text-zinc-500">
        {log.length === 0 ? (
          <li>Noch nichts abgespielt — Button klicken (Autoplay braucht Klick).</li>
        ) : (
          log.map((line) => <li key={line}>{line}</li>)
        )}
      </ul>
    </main>
  );
}
