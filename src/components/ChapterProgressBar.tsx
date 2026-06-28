"use client";

import { useEffect, useState } from "react";
import {
  chapterCompletionProgress,
  type ChapterCompletionProgress,
} from "@/lib/chapter/autoChapter";
import type { TurnRow } from "@/lib/db/stories";
import type { StoryPlotState } from "@/lib/memory/plotState";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

export function getChapterProgress(rows: TurnRow[]): ChapterCompletionProgress {
  return chapterCompletionProgress(rows);
}

type MemoryDetails = {
  plot: StoryPlotState | null;
  castCount: number;
  pinsCount: number;
  syncing: boolean;
};

type CloseChapterAction = {
  label: string;
  busyLabel: string;
  busy: boolean;
  onClick: () => void;
  // When the auto-close flow is offering options to the user, we surface a
  // hint badge so they know the button is interactive even before they open
  // the menu.
  hint?: string;
};

const T = {
  de: {
    memory: "Story-Memory",
    time: "Zeit",
    location: "Ort",
    present: (n: number) => `${n} anwesend`,
    threats: (n: number) => `${n} Bedrohung${n === 1 ? "" : "en"}`,
    characters: (n: number) => `${n} Figur${n === 1 ? "" : "en"}`,
    pins: (n: number) => `${n} Pin${n === 1 ? "" : "s"}`,
    syncing: "Sync läuft …",
    neverSynced: "Sync ausstehend",
    syncedAgo: (rel: string) => `Sync vor ${rel}`,
    openMemory: "Gedächtnis öffnen",
    openTimeline: "Zeitschiene öffnen",
    chapterProgress: "Kapitelfortschritt",
    veryLong: "Sehr lang — Übergang empfohlen",
    closeReady: "Kapitelabschluss möglich",
    remaining: (n: number) => `noch ca. ${n} % bis Übergang`,
    chapterPercent: (n: number) => `Kapitel: ${n}%`,
  },
  en: {
    memory: "Story memory",
    time: "Time",
    location: "Location",
    present: (n: number) => `${n} present`,
    threats: (n: number) => `${n} threat${n === 1 ? "" : "s"}`,
    characters: (n: number) => `${n} character${n === 1 ? "" : "s"}`,
    pins: (n: number) => `${n} pin${n === 1 ? "" : "s"}`,
    syncing: "Syncing…",
    neverSynced: "Sync pending",
    syncedAgo: (rel: string) => `Synced ${rel} ago`,
    openMemory: "Open memory",
    openTimeline: "Open timeline",
    chapterProgress: "Chapter progress",
    veryLong: "Very long — wrap up",
    closeReady: "Chapter close possible",
    remaining: (n: number) => `~${n}% to close`,
    chapterPercent: (n: number) => `Chapter: ${n}%`,
  },
};

function formatRelative(iso: string, lang: "de" | "en"): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return lang === "de" ? "gerade eben" : "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return lang === "de" ? `${min} Min` : `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return lang === "de" ? `${d} Tag${d === 1 ? "" : "e"}` : `${d} day${d === 1 ? "" : "s"}`;
}

/**
 * Combined header bar: chapter progress + collapsible story memory +
 * (optional) close-chapter action.
 *
 * Replaces the previous two-bar stack (ChapterProgressBar + MemoryStatusBar)
 * with a single, denser unit. Progress is always visible; memory details
 * start collapsed so the chat has more vertical space.
 */
export function ChapterProgressBar({
  rows,
  compact = false,
  memory,
  storyId,
  closeChapter,
}: {
  rows: TurnRow[];
  compact?: boolean;
  memory?: MemoryDetails;
  storyId?: string;
  closeChapter?: CloseChapterAction;
}) {
  // Hooks first — never put an early return before useState/useEffect/useLocale.
  const { locale } = useUiLocale();
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const t = T[lang];

  // Persist user choice per browser (only meaningful on the full bar).
  const storageKey = "rp:memoryBarCollapsed";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (compact) return;
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === "1") setOpen(true);
      else if (v === "0") setOpen(false);
    } catch {
      /* ignore */
    }
  }, [compact]);
  const toggle = () => {
    setOpen((cur) => {
      const next = !cur;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (!rows.length && !compact) return null;

  // Compact variant is the pill summary (used in the chapter toolbar).
  if (compact) {
    const progress = getChapterProgress(rows);
    const { percent, remainingPercent, ready, hardLimit } = progress;
    const statusLabel = hardLimit
      ? t.veryLong
      : ready
        ? t.closeReady
        : t.remaining(remainingPercent);
    return (
      <span
        className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-zinc-500"
        title={statusLabel}
      >
        {t.chapterPercent(percent)}
      </span>
    );
  }

  // Full bar: progress + (optional) memory toggle + (optional) close action.
  const progress = getChapterProgress(rows);
  const { percent, remainingPercent, ready, hardLimit } = progress;

  const statusLabel = hardLimit
    ? t.veryLong
    : ready
      ? t.closeReady
      : t.remaining(remainingPercent);

  const hasMemory = !!memory;
  const updatedAt = memory?.plot?.updatedAt ?? "";
  const rel = updatedAt ? formatRelative(updatedAt, lang) : "";
  const hasContent =
    !!memory?.plot &&
    (!!memory.plot.timeLabel ||
      !!memory.plot.location ||
      (memory.plot.presentCharacters?.length ?? 0) > 0);
  const presentCount = memory?.plot?.presentCharacters?.length ?? 0;
  const threatCount = memory?.plot?.threats?.length ?? 0;

  return (
    <div
      className="border-b border-surface-border bg-surface-raised/60 text-xs"
      data-testid="chapter-progress-bar"
    >
      {/* Always-visible row: progress + memory toggle + (optional) close action + sync indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span>{t.chapterProgress}</span>
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

        {hasMemory ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="memory-details"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-surface-border bg-surface px-2 py-1 text-[10px] text-zinc-300 hover:border-accent/40 hover:text-accent"
            title={t.memory}
          >
            <span
              className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
              aria-hidden
            >
              ▶
            </span>
            <span className="font-medium uppercase tracking-wide">
              {t.memory}
            </span>
            {memory?.syncing ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
            ) : null}
          </button>
        ) : null}

        {closeChapter ? (
          <button
            type="button"
            onClick={closeChapter.onClick}
            disabled={closeChapter.busy}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
            title={closeChapter.hint ?? closeChapter.label}
          >
            {closeChapter.busy ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            ) : (
              <span aria-hidden>✓</span>
            )}
            <span>{closeChapter.busy ? closeChapter.busyLabel : closeChapter.label}</span>
          </button>
        ) : null}
      </div>

      {/* Collapsible memory details */}
      {hasMemory && open ? (
        <div
          id="memory-details"
          className="flex flex-col gap-1 border-t border-surface-border bg-surface-raised/40 px-3 py-2 text-[11px] text-zinc-400"
        >
          {hasContent && memory?.plot?.timeLabel ? (
            <div className="text-zinc-300">
              <span className="text-zinc-500">{t.time}:</span>{" "}
              {memory.plot.timeLabel}
            </div>
          ) : null}
          {hasContent && memory?.plot?.location ? (
            <div className="text-zinc-300">
              <span className="text-zinc-500">{t.location}:</span>{" "}
              {memory.plot.location}
            </div>
          ) : null}
          {hasContent ? (
            <div className="flex flex-wrap gap-x-2">
              <span>{t.present(presentCount)}</span>
              <span className="text-zinc-500">·</span>
              <span>{t.threats(threatCount)}</span>
              <span className="text-zinc-500">·</span>
              <span>{t.characters(memory!.castCount)}</span>
              <span className="text-zinc-500">·</span>
              <span>{t.pins(memory!.pinsCount)}</span>
            </div>
          ) : (
            <div className="italic text-zinc-500">
              {lang === "de"
                ? "Noch nicht erfasst — füllt sich beim Chatten."
                : "Not captured yet — fills as you chat."}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span>
              {memory?.syncing
                ? <span className="text-amber-300">{t.syncing}</span>
                : rel
                  ? t.syncedAgo(rel)
                  : t.neverSynced}
            </span>
            {storyId ? (
              <div className="flex gap-2">
                <a
                  href={`/story/${storyId}/memory`}
                  className="text-accent underline"
                >
                  {t.openMemory}
                </a>
                <a
                  href={`/story/${storyId}/timeline`}
                  className="text-accent underline"
                >
                  {t.openTimeline}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
