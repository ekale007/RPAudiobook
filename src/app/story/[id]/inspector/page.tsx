"use client";

/**
 * Phase 7.3: Memory-Inspector (Diagnose Task 3B).
 *
 * Read-only debug view that shows all four story-memory layers side by side:
 *  1. Plot-State (authoritative presence/threats)
 *  2. Timeline (chronological beats with importance)
 *  3. Reflections (high-level "what's true now" snapshots, Phase 7.3)
 *  4. Chapter Chunks (hierarchical summary, Phase 7.2)
 *  5. Budget Report (what the prompt actually sees, Phase 7.3)
 *
 * Plus a live "what would the LLM see" preview at the bottom.
 *
 * This page is the human-facing equivalent of the validation toast:
 * if the LLM is producing inconsistent output, this is where you find out
 * which memory layer has the wrong data.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useStorySession } from "@/lib/story/useStorySession";
import { getStoryBundle } from "@/lib/db/stories";
import type { ChapterRow } from "@/lib/db/stories";
import { parseChapterChunks, type ChapterChunk } from "@/lib/memory/chapterChunks";
import {
  parseReflections,
  type ReflectionsContainer,
} from "@/lib/memory/reflections";
import { parseTimeline, type StoryTimeline } from "@/lib/memory/storyTimeline";
import { parsePlotState, type StoryPlotState } from "@/lib/memory/plotState";
import { buildStoryMemorySectionsDetailed } from "@/lib/memory/storyMemory";
import { DEFAULT_PROMPT_BUDGET_CHARS } from "@/lib/memory/promptBudget";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

interface InspectorData {
  plotState: StoryPlotState | null;
  timeline: StoryTimeline | null;
  reflections: ReflectionsContainer | null;
  chunks: ChapterChunk[];
  chapterTitle: string | null;
  chapterIndex: number;
  bandSummary: string | null;
  rollingSummary: string | null;
  closedChapterCount: number;
  pinnedNotesCount: number;
}

const T = {
  de: {
    title: "Memory-Inspector",
    subtitle: "Debug-Ansicht aller 4 Memory-Layer + was die KI tatsächlich sieht",
    sections: {
      plot: "Plot-State (authoritativ)",
      timeline: "Timeline (chronologisch, mit Importance)",
      reflections: "Reflections (was stimmt jetzt)",
      chunks: "Chapter-Chunks (hierarchische Verdichtung)",
      prompt: "Was die KI im System-Prompt sieht",
      budget: "Token-Budget Report",
    },
    empty: "(leer)",
    n: (label: string, n: number) => `${n}× ${label}`,
    character: (n: number) => `${n} Figur${n === 1 ? "" : "en"}`,
    event: (n: number) => `${n} Event${n === 1 ? "" : "s"}`,
    reflection: (n: number) => `${n} Snapshot${n === 1 ? "" : "s"}`,
    chunk: (n: number) => `${n} Chunk${n === 1 ? "" : "s"}`,
    chars: (n: number) => `${n.toLocaleString("de-DE")} Zeichen`,
    tokens: (n: number) => `≈ ${n.toLocaleString("de-DE")} Token`,
    importance: (n: number) => `Wichtigkeit ${Math.round(n * 100)}%`,
    dropped: (n: number) => `${n} verworfen`,
    truncated: (n: number) => `${n} gekürzt`,
    kept: (n: number) => `${n} behalten`,
    totalInput: (n: number) => `Eingabe: ${n.toLocaleString("de-DE")} Zeichen`,
    openMemory: "Zum Editor",
    loadFailed: "Konnte Memory-Stand nicht laden.",
  },
  en: {
    title: "Memory Inspector",
    subtitle: "Debug view of all 4 memory layers + what the AI actually sees",
    sections: {
      plot: "Plot state (authoritative)",
      timeline: "Timeline (chronological, with importance)",
      reflections: "Reflections (what's true now)",
      chunks: "Chapter chunks (hierarchical summary)",
      prompt: "What the AI sees in the system prompt",
      budget: "Token-budget report",
    },
    empty: "(empty)",
    n: (label: string, n: number) => `${n}× ${label}`,
    character: (n: number) => `${n} character${n === 1 ? "" : "s"}`,
    event: (n: number) => `${n} event${n === 1 ? "" : "s"}`,
    reflection: (n: number) => `${n} snapshot${n === 1 ? "" : "s"}`,
    chunk: (n: number) => `${n} chunk${n === 1 ? "" : "s"}`,
    chars: (n: number) => `${n.toLocaleString("en-US")} chars`,
    tokens: (n: number) => `≈ ${n.toLocaleString("en-US")} tokens`,
    importance: (n: number) => `Importance ${Math.round(n * 100)}%`,
    dropped: (n: number) => `${n} dropped`,
    truncated: (n: number) => `${n} truncated`,
    kept: (n: number) => `${n} kept`,
    totalInput: (n: number) => `Input: ${n.toLocaleString("en-US")} chars`,
    openMemory: "Open editor",
    loadFailed: "Failed to load memory state.",
  },
};

export default function MemoryInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const { authReady } = useStorySession(router);
  const { locale } = useUiLocale();
  const t = T[locale] ?? T.de;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InspectorData | null>(null);

  const load = useCallback(async () => {
    const storyId = params.id as string;
    setLoading(true);
    setError(null);
    try {
      const bundle = await getStoryBundle(storyId);
      const settings = (bundle.story.settings ?? {}) as Record<string, unknown>;
      const plotState = parsePlotState(settings.plotState);
      const timeline = parseTimeline(settings.timeline);
      const reflections = parseReflections(settings.storyReflections);
      const chapters: ChapterRow[] = bundle.chapters ?? [];
      const activeChapter =
        chapters.find((c) => c.status === "active") ?? chapters[0] ?? null;
      const chunks = activeChapter
        ? parseChapterChunks(
            (activeChapter as ChapterRow & { chapter_chunks?: unknown })
              .chapter_chunks,
          )
        : [];
      const closedChapterCount = chapters.filter((c) => c.status === "closed")
        .length;
      setData({
        plotState,
        timeline,
        reflections,
        chunks,
        chapterTitle: activeChapter?.title ?? null,
        chapterIndex: activeChapter?.index_in_band ?? 1,
        bandSummary: (bundle.band.band_summary as string | null) ?? null,
        rollingSummary: activeChapter?.rolling_summary ?? null,
        closedChapterCount,
        pinnedNotesCount: Array.isArray(
          (settings as { pinnedNotes?: unknown[] }).pinnedNotes,
        )
          ? (settings as { pinnedNotes: unknown[] }).pinnedNotes.length
          : 0,
      });
    } catch (e) {
      setError(t.loadFailed);
      console.error("Memory inspector load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [params.id, t.loadFailed]);

  useEffect(() => {
    if (!authReady) return;
    load().catch((e) => setError(t.loadFailed));
  }, [authReady, load, t.loadFailed]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        Laden …
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title={t.title} backHref={`/story/${params.id}`} />
        <div className="p-4 text-rose-300">{error ?? t.loadFailed}</div>
      </main>
    );
  }

  // Build the same prompt the LLM would see, then report on the budget.
  const detailed = buildStoryMemorySectionsDetailed({
    plotState: data.plotState,
    timeline: data.timeline,
    pinnedNotes: [], // count-only here, not the actual notes (avoids type-cycle)
    bandSummary: data.bandSummary,
    priorChapterSummaries: null,
    rollingSummary: data.rollingSummary,
    chapterTitle: data.chapterTitle,
    phaseHint: null,
    chapterIndex: data.chapterIndex,
    closedChapterCount: data.closedChapterCount,
    reflections: data.reflections,
  });

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={t.title} backHref={`/story/${params.id}`} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-12 text-sm">
        <header className="rounded-lg border border-surface-border bg-surface-raised/40 p-3">
          <h1 className="text-base font-semibold">{t.title}</h1>
          <p className="mt-0.5 text-xs text-zinc-400">{t.subtitle}</p>
        </header>

        {/* 1. Plot-State */}
        <Section
          title={t.sections.plot}
          meta={t.chars(detailed.budget.kept.find((l) => l.name === "plot")?.chars ?? 0)}
        >
          {data.plotState ? (
            <pre className="overflow-x-auto rounded bg-black/30 p-2 text-[11px] leading-relaxed">
{JSON.stringify(data.plotState, null, 2)}
            </pre>
          ) : (
            <p className="text-zinc-500">{t.empty}</p>
          )}
        </Section>

        {/* 2. Timeline */}
        <Section
          title={t.sections.timeline}
          meta={t.event(data.timeline?.events.length ?? 0)}
        >
          {data.timeline && data.timeline.events.length > 0 ? (
            <ul className="space-y-1 text-[12px]">
              {data.timeline.events
                .slice()
                .sort((a, b) => b.turnIndex - a.turnIndex)
                .slice(0, 12)
                .map((e) => (
                  <li
                    key={e.id}
                    className="rounded border border-white/5 bg-black/20 p-2"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10px] text-zinc-500">
                        {e.inStoryTime || `turn ${e.turnIndex}`}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {t.importance(e.importance ?? 0.5)}
                      </span>
                    </div>
                    <div className="mt-0.5">{e.summary}</div>
                    {e.actors.length > 0 ? (
                      <div className="mt-0.5 text-[10px] text-zinc-500">
                        {e.actors.join(", ")}
                        {e.location ? ` @ ${e.location}` : ""}
                      </div>
                    ) : null}
                  </li>
                ))}
              {data.timeline.events.length > 12 ? (
                <li className="text-[10px] text-zinc-500">
                  + {data.timeline.events.length - 12} weitere
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-zinc-500">{t.empty}</p>
          )}
        </Section>

        {/* 3. Reflections */}
        <Section
          title={t.sections.reflections}
          meta={t.reflection(data.reflections?.reflections.length ?? 0)}
        >
          {data.reflections && data.reflections.reflections.length > 0 ? (
            <ul className="space-y-2">
              {data.reflections.reflections
                .slice()
                .reverse()
                .map((r, i) => (
                  <li
                    key={`${r.turnIndex}-${i}`}
                    className="rounded border border-violet-500/20 bg-violet-500/5 p-2 text-[12px]"
                  >
                    <div className="text-[10px] text-zinc-500">
                      turn {r.turnIndex} · {new Date(r.updatedAt).toLocaleString(locale)}
                    </div>
                    {r.summary ? (
                      <p className="mt-1">{r.summary}</p>
                    ) : null}
                    {r.relationships.length > 0 ? (
                      <div className="mt-1">
                        <div className="text-[10px] uppercase text-zinc-500">Beziehungen</div>
                        <ul className="ml-3 list-disc">
                          {r.relationships.map((rel, k) => (
                            <li key={k}>{rel}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {r.keyFacts.length > 0 ? (
                      <div className="mt-1">
                        <div className="text-[10px] uppercase text-zinc-500">Fakten</div>
                        <ul className="ml-3 list-disc">
                          {r.keyFacts.map((f, k) => (
                            <li key={k}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-zinc-500">{t.empty}</p>
          )}
        </Section>

        {/* 4. Chapter Chunks */}
        <Section
          title={t.sections.chunks}
          meta={t.chunk(data.chunks.length)}
        >
          {data.chunks.length > 0 ? (
            <ul className="space-y-1 text-[12px]">
              {data.chunks.map((c, i) => (
                <li
                  key={i}
                  className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2"
                >
                  <div className="text-[10px] text-zinc-500">
                    turns {c.startTurnIndex}–{c.endTurnIndex} · {new Date(c.generatedAt).toLocaleString(locale)}
                  </div>
                  <div className="mt-0.5">{c.summary}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-500">{t.empty}</p>
          )}
        </Section>

        {/* 5. Budget Report */}
        <Section
          title={t.sections.budget}
          meta={t.tokens(detailed.budget.estimatedTokens)}
        >
          <ul className="space-y-1 text-[12px]">
            <li className="text-zinc-400">{t.totalInput(detailed.budget.inputChars)}</li>
            <li>
              <span className="text-emerald-300">{t.kept(detailed.budget.kept.length)}</span> ·{" "}
              <span className="text-amber-300">{t.truncated(detailed.budget.truncated.length)}</span> ·{" "}
              <span className="text-rose-300">{t.dropped(detailed.budget.dropped.length)}</span>
            </li>
            <li className="text-zinc-400">
              Budget: {DEFAULT_PROMPT_BUDGET_CHARS.toLocaleString(locale)} chars
            </li>
          </ul>
        </Section>

        {/* 6. Live prompt preview */}
        <Section title={t.sections.prompt} meta="">
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[10px] leading-relaxed">
{detailed.sections.join("\n\n---\n\n")}
          </pre>
        </Section>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/story/${params.id}/memory`)}
            className="rounded border border-surface-border px-3 py-1.5 text-xs hover:bg-white/5"
          >
            {t.openMemory}
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="rounded border border-surface-border px-3 py-1.5 text-xs hover:bg-white/5"
          >
            ↻
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised/40 p-3">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-accent">{title}</h2>
        {meta ? <span className="text-[10px] text-zinc-500">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}
