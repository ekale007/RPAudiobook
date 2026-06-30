"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useStorySession } from "@/lib/story/useStorySession";
import {
  getStoryOverview,
  getTurns,
  updateStorySettings,
} from "@/lib/db/stories";
import { EMPTY_TIMELINE, type StoryEvent, type StoryEventType, type StoryTimeline, STORY_EVENT_TYPES } from "@/lib/memory/storyTimeline";
import { parsePlotState } from "@/lib/memory/plotState";
import { extractTimeline } from "@/lib/memory/storyTimeline";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import { formatLlmLimitError } from "@/components/LlmUsagePanel";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import type { ChatTurn } from "@/lib/types";

const TYPE_META: Record<
  StoryEventType,
  { emoji: string; label: string; labelEn: string; tone: string }
> = {
  scene_change: { emoji: "↪", label: "Szenenwechsel", labelEn: "Scene change", tone: "bg-sky-500/20 text-sky-200 border-sky-500/40" },
  character_join: { emoji: "+", label: "Figur tritt auf", labelEn: "Character joins", tone: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
  character_leave: { emoji: "−", label: "Figur geht", labelEn: "Character leaves", tone: "bg-zinc-500/20 text-zinc-200 border-zinc-500/40" },
  item_acquired: { emoji: "◆", label: "Gegenstand", labelEn: "Item acquired", tone: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
  item_lost: { emoji: "◇", label: "Gegenstand weg", labelEn: "Item lost", tone: "bg-amber-700/20 text-amber-100 border-amber-700/40" },
  revelation: { emoji: "★", label: "Enthüllung", labelEn: "Revelation", tone: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40" },
  conflict: { emoji: "⚔", label: "Konflikt", labelEn: "Conflict", tone: "bg-rose-500/20 text-rose-200 border-rose-500/40" },
  death: { emoji: "☠", label: "Tod", labelEn: "Death", tone: "bg-red-700/20 text-red-200 border-red-700/40" },
  time_jump: { emoji: "⏳", label: "Zeitsprung", labelEn: "Time jump", tone: "bg-indigo-500/20 text-indigo-200 border-indigo-500/40" },
  scheduled: { emoji: "◷", label: "Geplant", labelEn: "Scheduled", tone: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40" },
  resolved: { emoji: "✓", label: "Erledigt", labelEn: "Resolved", tone: "bg-green-500/20 text-green-200 border-green-500/40" },
  other: { emoji: "·", label: "Sonstiges", labelEn: "Other", tone: "bg-zinc-700/20 text-zinc-300 border-zinc-700/40" },
};

const T = {
  de: {
    title: "Story-Zeitschiene",
    empty: "Noch keine Ereignisse. Sobald du chattest, füllt die KI die Zeitschiene automatisch.",
    syncNow: "Aus aktivem Kapitel synchronisieren",
    syncing: "Sync läuft …",
    syncedAt: (rel: string) => `Zuletzt aktualisiert vor ${rel}`,
    currentTime: "Aktuelle Zeit",
    noTimeYet: "Noch keine Zeit erfasst",
    typeFilter: "Typ",
    actorFilter: "Figur",
    allTypes: "Alle Typen",
    allActors: "Alle Figuren",
    showResolved: "Erledigte anzeigen",
    importanceFilter: "Wichtigkeit",
    importanceAll: "Alle",
    importanceHigh: "Nur wichtig (≥ 70%)",
    importanceMid: "Mittel + wichtig (≥ 40%)",
    turn: (n: number) => `Turn ${n}`,
    location: "Ort",
    actors: "Beteiligt",
    back: "Zurück zur Story",
    chapter: (title: string) => `Kapitel: ${title}`,
    noChapter: "Kein aktives Kapitel",
    noActiveChapter: "Es gibt kein aktives Kapitel — starte zuerst einen Chat.",
    failed: "Sync fehlgeschlagen",
    okNotice: "Zeitschiene aktualisiert und gespeichert.",
  },
  en: {
    title: "Story timeline",
    empty: "No events yet. Once you start chatting, the AI will fill this timeline automatically.",
    syncNow: "Sync from active chapter",
    syncing: "Syncing…",
    syncedAt: (rel: string) => `Last updated ${rel} ago`,
    currentTime: "Current time",
    noTimeYet: "No time captured yet",
    typeFilter: "Type",
    actorFilter: "Character",
    allTypes: "All types",
    allActors: "All characters",
    showResolved: "Show resolved",
    importanceFilter: "Importance",
    importanceAll: "All",
    importanceHigh: "Important only (≥ 70%)",
    importanceMid: "Medium + important (≥ 40%)",
    turn: (n: number) => `Turn ${n}`,
    location: "Location",
    actors: "Involved",
    back: "Back to story",
    chapter: (title: string) => `Chapter: ${title}`,
    noChapter: "No active chapter",
    noActiveChapter: "There is no active chapter — start a chat first.",
    failed: "Sync failed",
    okNotice: "Timeline updated and saved.",
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

function turnsToChat(rows: Awaited<ReturnType<typeof getTurns>>): ChatTurn[] {
  return rows.map((t) => ({
    role: t.role as ChatTurn["role"],
    content: t.content,
    speakerSlug: t.speaker_slug,
  }));
}

export default function StoryTimelinePage() {
  const { locale } = useUiLocale();
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const t = T[lang];
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<StoryTimeline | null>(null);
  const [typeFilter, setTypeFilter] = useState<StoryEventType | "all">("all");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [showResolved, setShowResolved] = useState(true);
  const [importanceFilter, setImportanceFilter] = useState<"all" | "mid" | "high">("all");

  const load = useCallback(async () => {
    const overview = await getStoryOverview(storyId);
    const active = overview.chapters.find((c) => c.status === "active");
    setActiveChapterId(active?.id ?? null);
    setChapterTitle(active?.title ?? null);
    const raw = overview.storySettings.timeline as StoryTimeline | null | undefined;
    setTimeline(raw ?? null);
  }, [storyId]);

  const { authReady } = useStorySession(router);

  useEffect(() => {
    if (!authReady) return;
    load()
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [authReady, load]);

  // Re-render every 30s so "last updated X min ago" stays current.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const syncFromChapter = async () => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError(lang === "de" ? "OpenRouter-Key in Settings fehlt." : "OpenRouter key missing in Settings.");
      return;
    }
    if (!activeChapterId) {
      setError(t.noActiveChapter);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const rows = await getTurns(activeChapterId);
      if (!rows.length) {
        setError(lang === "de" ? "Aktives Kapitel hat noch keine Nachrichten." : "Active chapter has no messages yet.");
        return;
      }
      const updated = await extractTimeline(
        settings,
        turnsToChat(rows),
        timeline,
        { chapterTitle: chapterTitle ?? undefined },
      );
      setTimeline(updated);
      await updateStorySettings(storyId, { timeline: updated });
      setNotice(t.okNotice);
    } catch (e) {
      setError(`${t.failed}: ${formatLlmLimitError(e instanceof Error ? e.message : String(e), locale)}`);
    } finally {
      setBusy(false);
    }
  };

  const events = timeline?.events ?? [];
  const allActors = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) for (const a of e.actors) if (a) s.add(a);
    return Array.from(s).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (actorFilter && !e.actors.includes(actorFilter)) return false;
      if (!showResolved && (e.type === "resolved" || e.type === "death")) return false;
      // Importance filter — events without `importance` are treated as 0.5
      // (matches `eventImportance()` in storyTimeline.ts).
      if (importanceFilter !== "all") {
        const imp = typeof e.importance === "number" ? e.importance : 0.5;
        if (importanceFilter === "high" && imp < 0.7) return false;
        if (importanceFilter === "mid" && imp < 0.4) return false;
      }
      return true;
    });
  }, [events, typeFilter, actorFilter, showResolved, importanceFilter]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        {lang === "de" ? "Laden …" : "Loading…"}
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={t.title} backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">
            {chapterTitle ? t.chapter(chapterTitle) : t.noChapter} ·{" "}
            <span className="text-zinc-400">
              {t.currentTime}:{" "}
              <span className="text-zinc-200">
                {timeline?.currentTime || t.noTimeYet}
              </span>
            </span>
            {timeline?.updatedAt ? (
              <>
                {" · "}
                <span className="text-zinc-500">
                  {t.syncedAt(formatRelative(timeline.updatedAt, lang))}
                </span>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={syncFromChapter}
            disabled={busy}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
          >
            {busy ? t.syncing : t.syncNow}
          </button>
        </div>

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {notice}
          </p>
        ) : null}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-zinc-400">
            {t.typeFilter}:
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as StoryEventType | "all")}
              className="rounded border border-surface-border bg-surface px-2 py-1 text-xs text-zinc-100"
            >
              <option value="all">{t.allTypes}</option>
              {STORY_EVENT_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {TYPE_META[tt][lang === "en" ? "labelEn" : "label"]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-zinc-400">
            {t.actorFilter}:
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded border border-surface-border bg-surface px-2 py-1 text-xs text-zinc-100"
            >
              <option value="">{t.allActors}</option>
              {allActors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-zinc-400">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="h-3 w-3"
            />
            {t.showResolved}
          </label>
          <label className="flex items-center gap-1 text-zinc-400">
            {t.importanceFilter}:
            <select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value as "all" | "mid" | "high")}
              className="rounded border border-surface-border bg-surface px-2 py-1 text-xs text-zinc-100"
            >
              <option value="all">{t.importanceAll}</option>
              <option value="mid">{t.importanceMid}</option>
              <option value="high">{t.importanceHigh}</option>
            </select>
          </label>
        </div>

        {/* Events list */}
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-surface-border bg-surface-raised/40 p-6 text-center text-sm text-zinc-500">
            {events.length === 0 ? t.empty : (lang === "de" ? "Keine Ereignisse passen zum Filter." : "No events match the filter.")}
          </p>
        ) : (
          <ol className="space-y-3">
            {filtered.map((e, i) => (
              <TimelineEventRow
                key={e.id}
                event={e}
                lang={lang}
                isLatest={
                  i === filtered.length - 1 ||
                  events[events.length - 1]?.id === e.id
                }
              />
            ))}
          </ol>
        )}

        <p className="mt-4 text-xs text-zinc-500">
          <Link href={`/story/${storyId}/memory`} className="text-accent underline">
            {lang === "de" ? "→ Plot-State & Pinnpunkte bearbeiten" : "→ Edit plot state & pins"}
          </Link>
        </p>
      </div>
    </main>
  );
}

function TimelineEventRow({
  event,
  lang,
  isLatest,
}: {
  event: StoryEvent;
  lang: "de" | "en";
  isLatest: boolean;
}) {
  const meta = TYPE_META[event.type] ?? TYPE_META.other;
  const t = T[lang];
  return (
    <li
      className={`relative rounded-lg border bg-surface-raised/60 p-3 ${meta.tone} ${
        isLatest ? "ring-1 ring-accent/40" : "border-surface-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border text-sm ${meta.tone}`}
          aria-hidden
        >
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2 text-[11px] text-zinc-400">
            <span className="font-medium text-zinc-300">
              {event.inStoryTime || (lang === "de" ? "Unbekannte Zeit" : "Unknown time")}
            </span>
            {event.location ? (
              <>
                <span>·</span>
                <span>{t.location}: {event.location}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{t.turn(Math.max(1, event.turnIndex + 1))}</span>
            <span>·</span>
            <span className="text-zinc-500">{meta[lang === "en" ? "labelEn" : "label"]}</span>
            {event.confidence != null ? (
              <span className="text-zinc-500">· {(event.confidence * 100).toFixed(0)}%</span>
            ) : null}
            {event.importance != null ? (
              <span
                className={
                  "rounded px-1 text-[10px] " +
                  (event.importance >= 0.7
                    ? "bg-amber-500/15 text-amber-300"
                    : event.importance <= 0.3
                      ? "bg-zinc-500/10 text-zinc-500"
                      : "bg-surface-border/40 text-zinc-400")
                }
                title={
                  lang === "de"
                    ? `Plot-Wichtigkeit: ${(event.importance * 100).toFixed(0)}%`
                    : `Plot importance: ${(event.importance * 100).toFixed(0)}%`
                }
              >
                {event.importance >= 0.7 ? "★" : event.importance <= 0.3 ? "·" : "•"}{" "}
                {(event.importance * 100).toFixed(0)}%
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-100">{event.summary}</p>
          {event.actors.length > 0 ? (
            <p className="mt-1 text-[11px] text-zinc-400">
              <span className="text-zinc-500">{t.actors}:</span> {event.actors.join(", ")}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// suppress unused warning
void parsePlotState;
