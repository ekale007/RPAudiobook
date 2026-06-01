"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CastHubPanel } from "@/components/story-hub/CastHubPanel";
import { StoryCoverEditor } from "@/components/StoryCoverEditor";
import type { ChapterRow, CharacterRow } from "@/lib/db/stories";
import type { StorySettings } from "@/lib/types";
import {
  isPlotStateEmpty,
  isPlotStatePlaceholder,
} from "@/lib/memory/plotState";

type HubTab = "story" | "cast" | "settings";

const TABS: { id: HubTab; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "cast", label: "Cast" },
  { id: "settings", label: "Settings" },
];

function HubCard({
  title,
  action,
  children,
  accent,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border p-2.5 ${
        accent
          ? "border-accent/30 bg-accent/5"
          : "border-surface-border bg-surface-raised"
      } ${className}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2
          className={`text-xs font-medium ${
            accent ? "text-accent" : "text-zinc-400"
          }`}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SettingsLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-2 transition hover:border-accent/30"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-200">{title}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
          {description}
        </p>
      </div>
      <span className="shrink-0 text-sm text-zinc-600" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function StoryHubView({
  storyId,
  userId,
  title,
  storyConcept,
  coverStoragePath,
  settings,
  storySettings,
  bandTitle,
  bandSummary,
  chapters,
  cast,
  storyLocale,
  activeChapterId,
  error,
  editingTitle,
  titleDraft,
  titleBusy,
  expandedSummaryId,
  deleteBusyId,
  canDeleteAny,
  onCoverUpdated,
  onStartRename,
  onTitleDraftChange,
  onSaveTitle,
  onCancelRename,
  onDeleteChapter,
  onToggleSummary,
  onCastUpdated,
}: {
  storyId: string;
  userId: string | null;
  title: string;
  storyConcept: string | null;
  coverStoragePath?: string | null;
  settings: Record<string, unknown>;
  storySettings: StorySettings;
  bandTitle: string;
  bandSummary: string | null;
  chapters: ChapterRow[];
  cast: CharacterRow[];
  storyLocale: "de" | "en";
  activeChapterId?: string;
  error: string | null;
  editingTitle: boolean;
  titleDraft: string;
  titleBusy: boolean;
  expandedSummaryId: string | null;
  deleteBusyId: string | null;
  canDeleteAny: boolean;
  onCoverUpdated: (path: string | null) => void;
  onStartRename: () => void;
  onTitleDraftChange: (v: string) => void;
  onSaveTitle: () => void;
  onCancelRename: () => void;
  onDeleteChapter: (ch: ChapterRow) => void;
  onToggleSummary: (id: string | null) => void;
  onCastUpdated?: () => void;
}) {
  const [tab, setTab] = useState<HubTab>("story");

  const chaptersNewestFirst = useMemo(
    () => [...chapters].sort((a, b) => b.index_in_band - a.index_in_band),
    [chapters],
  );

  const plotState = storySettings.plotState;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {activeChapterId ? (
        <Link
          href={`/story/${storyId}/chat?chapter=${activeChapterId}`}
          className="mx-3 mt-2 shrink-0 rounded-lg bg-accent py-2 text-center text-sm font-medium text-black sm:mx-4"
        >
          Weiterspielen
        </Link>
      ) : (
        <p className="mx-3 mt-2 shrink-0 rounded-lg border border-amber-800/40 bg-amber-950/25 px-3 py-2 text-center text-[11px] text-amber-100 sm:mx-4">
          Kein aktives Kapitel
        </p>
      )}

      <nav
        className="mt-2 shrink-0 border-b border-surface-border px-3 sm:px-4"
        aria-label="Story Hub"
        role="tablist"
      >
        <div className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              onClick={() => setTab(id)}
              aria-selected={tab === id}
              className={`flex-1 touch-manipulation rounded-t-md px-2 py-2 text-xs font-medium transition ${
                tab === id
                  ? "border-b-2 border-accent bg-surface-raised text-accent"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3 pb-8 sm:gap-3 sm:p-4">
        {tab === "story" ? (
          <>
            {userId ? (
              <StoryCoverEditor
                merged
                storyId={storyId}
                userId={userId}
                title={title}
                description={storyConcept}
                coverStoragePath={coverStoragePath}
                settings={settings}
                onUpdated={onCoverUpdated}
                editingTitle={editingTitle}
                titleDraft={titleDraft}
                titleBusy={titleBusy}
                onStartRename={onStartRename}
                onTitleDraftChange={onTitleDraftChange}
                onSaveTitle={onSaveTitle}
                onCancelRename={onCancelRename}
              />
            ) : null}

            <HubCard
              title="Plot & Memory"
              accent
              action={
                <Link
                  href={`/story/${storyId}/memory`}
                  className="text-[10px] text-accent underline"
                >
                  Bearbeiten
                </Link>
              }
            >
              {plotState && !isPlotStateEmpty(plotState) ? (
                <>
                  <p className="text-[11px] text-zinc-400">
                    {[
                      !isPlotStatePlaceholder(plotState.timeLabel)
                        ? plotState.timeLabel
                        : null,
                      !isPlotStatePlaceholder(plotState.location)
                        ? plotState.location
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Zeit/Ort noch nicht gesetzt"}
                  </p>
                  {plotState.threats.length ? (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-300">
                      {plotState.threats.slice(0, 4).map((t) => (
                        <li key={t.id} className="line-clamp-1">
                          {t.label}:{" "}
                          <span
                            className={
                              t.status === "active"
                                ? "text-amber-300"
                                : "text-green-400/90"
                            }
                          >
                            {t.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Plot-State leer — im Chat generieren oder manuell pflegen.
                </p>
              )}
              {(storySettings.pinnedNotes?.length ?? 0) > 0 ? (
                <p className="mt-1 text-[10px] text-zinc-500">
                  {storySettings.pinnedNotes!.length} Pinnpunkt(e)
                </p>
              ) : null}
            </HubCard>

            <HubCard title={bandTitle}>
              {bandSummary ? (
                <p className="max-h-32 overflow-y-auto text-[11px] leading-relaxed text-zinc-400">
                  {bandSummary}
                </p>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Nach dem Schließen eines Kapitels wird die Band-Zusammenfassung
                  ergänzt.
                </p>
              )}
            </HubCard>

            <section>
              <h2 className="mb-1.5 text-xs font-medium text-zinc-400">
                Kapitel
              </h2>
              <ul className="flex flex-col gap-1.5">
                {chaptersNewestFirst.map((ch) => {
                  const isActive = ch.status === "active";
                  const summaryExpanded = expandedSummaryId === ch.id;
                  const hasSummary = Boolean(ch.chapter_summary?.trim());

                  return (
                    <li
                      key={ch.id}
                      className={`relative overflow-hidden rounded-lg border ${
                        isActive
                          ? "border-accent/40 bg-accent/10"
                          : "border-surface-border bg-surface-raised"
                      }`}
                    >
                      {canDeleteAny ? (
                        <button
                          type="button"
                          disabled={deleteBusyId === ch.id}
                          onClick={() => onDeleteChapter(ch)}
                          className="absolute right-1.5 top-1.5 z-10 px-1 text-sm text-red-400/80 disabled:opacity-40"
                          aria-label={`${ch.title} löschen`}
                        >
                          {deleteBusyId === ch.id ? "…" : "×"}
                        </button>
                      ) : null}
                      <div className="flex flex-col items-center gap-2.5 px-3 py-3">
                        <div className="w-full text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <span className="text-sm font-medium text-zinc-100">
                              {ch.title}
                            </span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                                isActive
                                  ? "bg-accent/25 text-accent"
                                  : "bg-zinc-800 text-zinc-500"
                              }`}
                            >
                              {isActive ? "Aktiv" : "Zu"}
                            </span>
                          </div>
                          {ch.phase_hint ? (
                            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                              {ch.phase_hint}
                            </p>
                          ) : null}
                        </div>
                        <Link
                          href={`/story/${storyId}/chat?chapter=${ch.id}`}
                          className={`min-w-[8.5rem] rounded-lg px-5 py-2.5 text-center text-sm font-semibold ${
                            isActive
                              ? "bg-accent text-black"
                              : "border border-accent/35 bg-accent/10 text-accent"
                          }`}
                        >
                          {isActive ? "Spielen" : "Lesen"}
                        </Link>
                      </div>
                      {hasSummary ? (
                        <div className="border-t border-surface-border/50 px-2 py-1.5">
                          <p
                            className={`text-[10px] leading-relaxed text-zinc-500 ${
                              summaryExpanded ? "" : "line-clamp-2"
                            }`}
                          >
                            {ch.chapter_summary}
                          </p>
                          {ch.chapter_summary!.length > 120 ? (
                            <button
                              type="button"
                              onClick={() =>
                                onToggleSummary(summaryExpanded ? null : ch.id)
                              }
                              className="mt-0.5 text-[10px] text-accent underline"
                            >
                              {summaryExpanded ? "Weniger" : "Mehr"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        ) : null}

        {tab === "cast" ? (
          <CastHubPanel
            storyId={storyId}
            storyTitle={title}
            storyConcept={storyConcept}
            userId={userId}
            cast={cast}
            storyLocale={storyLocale}
            storySettings={storySettings}
            onSaved={onCastUpdated}
          />
        ) : null}

        {tab === "settings" ? (
          <div className="flex flex-col gap-1.5">
            <SettingsLink
              href={`/story/${storyId}/world`}
              title="Welt & Lorebook"
              description="Lore-Einträge, Keys und Weltbeschreibung pflegen"
            />
            <SettingsLink
              href={`/story/${storyId}/memory`}
              title="Story-Gedächtnis"
              description="Plot-State und Pinnpunkte pflegen"
            />
            <SettingsLink
              href={`/story/${storyId}/pronunciation`}
              title="Aussprache-Zentrale"
              description="Phonetische Namen testen und hinterlegen"
            />
            <SettingsLink
              href={`/story/${storyId}/chapter`}
              title="Kapitel schließen"
              description="Aktuelles Kapitel abschließen und nächstes starten"
            />
            <SettingsLink
              href={`/story/${storyId}/export`}
              title="Karten & Lorebooks exportieren"
              description="WryTour-JSON für Figuren und Lore herunterladen"
            />
            <Link
              href="/story/new"
              className="mt-2 text-center text-[10px] text-zinc-600 underline"
            >
              Weitere Story mit KI anlegen
            </Link>
          </div>
        ) : null}

        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
