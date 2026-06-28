"use client";

import { useEffect, useState } from "react";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import type { StoryPlotState } from "@/lib/memory/plotState";

type MemoryStatusBarProps = {
  plot: StoryPlotState | null;
  castCount: number;
  pinsCount: number;
  /** True when at least one LLM-driven memory sync is currently in flight. */
  syncing: boolean;
};

type LocaleMessages = {
  title: string;
  empty: string;
  syncedAgo: (relative: string) => string;
  syncing: string;
  neverSynced: string;
  characters: (n: number) => string;
  pins: (n: number) => string;
  timeLabel: string;
  location: string;
  present: (n: number) => string;
  threats: (n: number) => string;
  linkToMemory: string;
};

const MESSAGES: Record<"de" | "en", LocaleMessages> = {
  de: {
    title: "Story-Gedächtnis",
    empty: "Noch nicht angelegt",
    syncedAgo: (r) => `Sync vor ${r}`,
    syncing: "Sync läuft …",
    neverSynced: "Sync ausstehend",
    characters: (n) => `${n} Figur${n === 1 ? "" : "en"}`,
    pins: (n) => `${n} Pin${n === 1 ? "" : "s"}`,
    timeLabel: "Zeit",
    location: "Ort",
    present: (n) => `${n} anwesend`,
    threats: (n) => `${n} Bedrohung${n === 1 ? "" : "en"}`,
    linkToMemory: "Gedächtnis öffnen",
  },
  en: {
    title: "Story memory",
    empty: "Not set up yet",
    syncedAgo: (r) => `Synced ${r} ago`,
    syncing: "Syncing…",
    neverSynced: "Sync pending",
    characters: (n) => `${n} character${n === 1 ? "" : "s"}`,
    pins: (n) => `${n} pin${n === 1 ? "" : "s"}`,
    timeLabel: "Time",
    location: "Location",
    present: (n) => `${n} present`,
    threats: (n) => `${n} threat${n === 1 ? "" : "s"}`,
    linkToMemory: "Open memory",
  },
};

function formatRelative(iso: string, locale: "de" | "en"): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return locale === "de" ? "gerade eben" : "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return locale === "de" ? `${min} Min` : `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return locale === "de" ? `${h} h` : `${h} h`;
  const d = Math.floor(h / 24);
  return locale === "de" ? `${d} Tag${d === 1 ? "" : "e"}` : `${d} day${d === 1 ? "" : "s"}`;
}

export function MemoryStatusBar({
  plot,
  castCount,
  pinsCount,
  syncing,
}: MemoryStatusBarProps) {
  const { locale } = useUiLocale();
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const m = MESSAGES[lang];

  // Re-render every 30s so the "synced X min ago" label stays accurate.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const updatedAt = plot?.updatedAt ?? "";
  const rel = updatedAt ? formatRelative(updatedAt, lang) : "";
  const hasContent =
    !!plot && (!!plot.timeLabel || !!plot.location || (plot.presentCharacters?.length ?? 0) > 0);
  const presentCount = plot?.presentCharacters?.length ?? 0;
  const threatCount = plot?.threats?.length ?? 0;

  return (
    <div
      className="mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-surface-border bg-surface-raised/60 px-3 py-1.5 text-[11px] text-zinc-400"
      aria-live="polite"
    >
      <span className="font-medium uppercase tracking-wide text-zinc-300">
        {m.title}
      </span>
      {hasContent && plot?.timeLabel ? (
        <span className="text-zinc-300">
          <span className="text-zinc-500">{m.timeLabel}:</span> {plot.timeLabel}
        </span>
      ) : null}
      {hasContent && plot?.location ? (
        <span className="text-zinc-300">
          <span className="text-zinc-500">{m.location}:</span> {plot.location}
        </span>
      ) : null}
      {hasContent ? (
        <>
          <span className="text-zinc-500">·</span>
          <span>{m.present(presentCount)}</span>
          <span className="text-zinc-500">·</span>
          <span>{m.threats(threatCount)}</span>
        </>
      ) : null}
      <span className="text-zinc-500">·</span>
      <span>{m.characters(castCount)}</span>
      <span className="text-zinc-500">·</span>
      <span>{m.pins(pinsCount)}</span>
      <span className="text-zinc-500">·</span>
      <span>
        {syncing
          ? <span className="text-amber-300">{m.syncing}</span>
          : rel
            ? m.syncedAgo(rel)
            : m.neverSynced}
      </span>
      {!hasContent ? (
        <span className="text-zinc-500">— {m.empty}</span>
      ) : null}
    </div>
  );
}
