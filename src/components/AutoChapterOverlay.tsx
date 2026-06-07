"use client";

import { GeneratingIndicator } from "@/components/GeneratingIndicator";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import {
  AUTO_CHAPTER_HARD_TURNS,
  chapterCompletionProgress,
  estimateTranscriptChars,
} from "@/lib/chapter/autoChapter";
import type { TurnRow } from "@/lib/db/stories";

export type AutoChapterOverlayPhase = "prompt" | "running";

export function AutoChapterOverlay({
  open,
  phase,
  rows,
  status,
  onAutoContinue,
  onManualTransition,
  onDismiss,
  onCancelRunning,
}: {
  open: boolean;
  phase: AutoChapterOverlayPhase;
  rows: TurnRow[];
  status: string | null;
  onAutoContinue: () => void;
  onManualTransition: () => void;
  onDismiss: () => void;
  onCancelRunning?: () => void;
}) {
  const turnCount = rows.length;
  const charCount = estimateTranscriptChars(rows);
  const hardLimit = turnCount >= AUTO_CHAPTER_HARD_TURNS;
  const chapterProgress = chapterCompletionProgress(rows);

  if (!open) return null;

  if (phase === "running") {
    return (
      <OverlayPanel
        open
        onClose={() => {}}
        title="Kapitelübergang"
        blocking
        hideClose
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm leading-relaxed text-zinc-300">
            Das aktuelle Kapitel wird geschlossen und das nächste vorbereitet.
            Das kann einen Moment dauern.
          </p>
          <GeneratingIndicator
            label={status ?? "Bitte warten …"}
            onCancel={onCancelRunning}
          />
        </div>
      </OverlayPanel>
    );
  }

  return (
    <OverlayPanel
      open
      onClose={onDismiss}
      title="Kapitelübergang"
      blocking
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm leading-relaxed text-zinc-300">
          {hardLimit
            ? "Dieses Kapitel ist sehr lang — ein Übergang wird empfohlen, damit die Story übersichtlich bleibt."
            : "Dieses Kapitel ist groß genug für einen natürlichen Schnitt. Du kannst den Übergang automatisch starten oder ihn selbst gestalten."}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              {turnCount} Nachrichten · ca. {Math.round(charCount / 1000)}k
              Zeichen
            </span>
            <span className="text-accent">
              {chapterProgress.percent}% Kapitel
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${chapterProgress.percent}%` }}
            />
          </div>
          {!chapterProgress.ready ? (
            <p className="text-xs text-zinc-500">
              Noch ca. {chapterProgress.remainingPercent} % bis zum empfohlenen
              Kapitelabschluss.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onAutoContinue}
          className="rounded-xl bg-accent py-3 text-sm font-medium text-black"
        >
          Automatisch schließen &amp; weiter
        </button>
        <button
          type="button"
          onClick={onManualTransition}
          className="rounded-xl border border-surface-border bg-surface-raised py-3 text-sm font-medium text-zinc-200"
        >
          Übergang selbst gestalten
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-center text-xs text-zinc-500 underline"
        >
          Später — erst weiter spielen
        </button>
      </div>
    </OverlayPanel>
  );
}
