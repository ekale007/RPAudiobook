"use client";

import {
  chapterCompletionProgress,
  type ChapterCompletionProgress,
} from "@/lib/chapter/autoChapter";
import type { TurnRow } from "@/lib/db/stories";

export function getChapterProgress(rows: TurnRow[]): ChapterCompletionProgress {
  return chapterCompletionProgress(rows);
}

export function ChapterProgressBar({
  rows,
  compact = false,
}: {
  rows: TurnRow[];
  compact?: boolean;
}) {
  if (!rows.length) return null;

  const progress = getChapterProgress(rows);
  const { percent, remainingPercent, ready, hardLimit } = progress;

  const statusLabel = hardLimit
    ? "Sehr lang — Übergang empfohlen"
    : ready
      ? "Kapitelabschluss möglich"
      : `noch ca. ${remainingPercent} % bis Übergang`;

  if (compact) {
    return (
      <span
        className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-500"
        title={statusLabel}
      >
        Kapitel: {percent}%
      </span>
    );
  }

  return (
    <div
      className="border-b border-surface-border bg-surface-raised/60 px-4 py-2"
      title={statusLabel}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span>Kapitelfortschritt</span>
        <span className={ready ? "text-accent" : "text-zinc-400"}>
          {percent}% · {statusLabel}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            ready ? "bg-accent" : "bg-zinc-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
