"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useStorySession } from "@/lib/story/useStorySession";
import {
  CHAPTER_INTRO_OPTIONS,
  getLastAssistantTurn,
  getTrailingAssistantTurns,
  polishChapterIntroText,
  previewText,
  resolveChapterIntro,
  type ChapterIntroMode,
} from "@/lib/chapter/chapterIntro";
import { summarizeChapter } from "@/lib/chapter/summarize";
import {
  finalizeChapterPlotState,
  phaseHintForNextChapter,
} from "@/lib/chapter/finalizeChapter";
import {
  createNextChapter,
  getStoryBundle,
  getTurns,
  seedChapterIntro,
  touchStoryUpdated,
  updateChapterSummaries,
  updateChapterTitle,
  rebuildBandSummary,
  rebuildBandSummaryIncremental,
} from "@/lib/db/stories";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import type { TurnRow } from "@/lib/db/stories";
import type { ChatTurn } from "@/lib/types";

export default function ChapterManagePage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;
  const [chapterTitle, setChapterTitle] = useState("");
  const [nextTitle, setNextTitle] = useState("");
  const [phaseHint, setPhaseHint] = useState("");
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [bandId, setBandId] = useState<string | null>(null);
  const [nextIndex, setNextIndex] = useState(2);
  const [priorTurns, setPriorTurns] = useState<TurnRow[]>([]);
  const [plotState, setPlotState] = useState<
    import("@/lib/memory/plotState").StoryPlotState | null
  >(null);
  const [introMode, setIntroMode] = useState<ChapterIntroMode>("ai_bridge");
  const [customIntro, setCustomIntro] = useState("");
  const [storyLocale, setStoryLocale] = useState<"de" | "en">("de");
  const [introAiBusy, setIntroAiBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { authReady } = useStorySession(router);

  useEffect(() => {
    if (!authReady) return;
    getStoryBundle(storyId).then(async (b) => {
          setActiveChapterId(b.activeChapter.id);
          setChapterTitle(b.activeChapter.title);
          setBandId(b.band.id as string);
          setStoryLocale(b.story.locale === "en" ? "en" : "de");
          const idx =
            Math.max(...b.chapters.map((c) => c.index_in_band), 0) + 1;
          setNextIndex(idx);
          setNextTitle(`Chapter ${idx}`);
          setPlotState(b.storySettings.plotState ?? null);
          const turns = await getTurns(b.activeChapter.id);
          setPriorTurns(turns);
          const last = getLastAssistantTurn(turns);
          setIntroMode(last ? "ai_bridge" : "empty");
        });
  }, [authReady, storyId]);

  const introPreviews = useMemo(() => {
    const last = getLastAssistantTurn(priorTurns);
    const trailing = getTrailingAssistantTurns(priorTurns);
    return {
      last_narration: last ? previewText(last.content) : null,
      last_scene: trailing.length
        ? previewText(
            trailing.map((t) => t.content).join("\n\n"),
            200,
          )
        : null,
    };
  }, [priorTurns]);

  const polishCustomIntro = async () => {
    if (!customIntro.trim()) {
      setStatus("Zuerst einen Entwurf eingeben — die KI optimiert deinen Text.");
      return;
    }
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setStatus("OpenRouter-Key in Settings eintragen (für KI-Optimierung).");
      return;
    }
    const last = getLastAssistantTurn(priorTurns);
    setIntroAiBusy(true);
    setStatus(null);
    try {
      const polished = await polishChapterIntroText(settings, {
        text: customIntro,
        locale: storyLocale,
        previousChapterTitle: chapterTitle.trim() || undefined,
        nextChapterTitle: nextTitle.trim() || undefined,
        lastSceneExcerpt: last?.content ?? null,
      });
      setCustomIntro(polished);
      setStatus("Eröffnung optimiert — bei Bedarf anpassen und Kapitel schließen.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setIntroAiBusy(false);
    }
  };

  const closeChapter = async () => {
    if (!activeChapterId || !bandId) return;
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setStatus("OpenRouter-Key in Settings eintragen (für Zusammenfassung).");
      return;
    }
    if (introMode === "custom" && !customIntro.trim()) {
      setStatus("Eigener Text ist leer — Text eintragen oder andere Option wählen.");
      return;
    }

    setBusy(true);
    setStatus("Kapitel wird zusammengefasst …");
    try {
      if (chapterTitle.trim()) {
        await updateChapterTitle(activeChapterId, chapterTitle.trim());
      }

      const turns: TurnRow[] =
        priorTurns.length > 0 ? priorTurns : await getTurns(activeChapterId);

      setStatus("Plot-Stand wird gesichert …");
      const plot = await finalizeChapterPlotState({
        settings,
        storyId,
        rows: turns,
        chapterTitle: chapterTitle.trim() || "Chapter",
        phaseHint: phaseHint.trim() || null,
        existingPlot: plotState,
      });
      const nextPhaseHint = phaseHintForNextChapter(plot, phaseHint.trim() || null);

      const chatTurns: ChatTurn[] = turns.map((t) => ({
        role: t.role as ChatTurn["role"],
        content: t.content,
        speakerSlug: t.speaker_slug,
      }));
      const summary = await summarizeChapter(
        settings,
        chatTurns,
        chapterTitle,
      );
      await updateChapterSummaries(activeChapterId, {
        chapter_summary: summary,
        status: "closed",
        closed_at: new Date().toISOString(),
      });

      const title = nextTitle.trim() || `Chapter ${nextIndex}`;

      if (introMode === "ai_bridge") {
        setStatus("Eröffnung wird geschrieben …");
      }

      const intro = await resolveChapterIntro(introMode, {
        settings,
        priorTurns: turns,
        chapterSummary: summary,
        previousChapterTitle: chapterTitle,
        nextChapterTitle: title,
        phaseHint: nextPhaseHint ?? null,
        customText: customIntro,
      });

      const newChapter = await createNextChapter(
        bandId,
        nextIndex,
        title,
        nextPhaseHint,
      );

      if (intro.turns.length) {
        await seedChapterIntro(newChapter.id, intro.turns, storyId);
      }

      // Phase 7.2: incremental cross-chapter consolidation. We try the
      // incremental path first (LLM merges "previous band" + "new chapter"),
      // and fall back to the full re-aggregation when the previous band is
      // missing/too long. See lib/chapter/bandSummary.ts.
      setStatus("Band-Übersicht wird konsolidiert …");
      const overview = await getStoryBundle(storyId);
      const previousBandSummary =
        (overview.band.band_summary as string | null) ?? null;
      // The chapter we just closed is now in `overview.chapters` with
      // status="closed" and chapter_summary set. Its index in the band
      // is `nextIndex - 1` because the next chapter is at `nextIndex`.
      const closedChapterIndex = Math.max(1, nextIndex - 1);
      try {
        await rebuildBandSummaryIncremental({
          bandId,
          bandSummary: previousBandSummary,
          newChapterTitle: chapterTitle.trim() || `Chapter ${closedChapterIndex}`,
          newChapterIndex: closedChapterIndex,
          newChapterSummary: summary,
          fallbackChapters: overview.chapters,
          settings,
        });
      } catch (e) {
        console.warn("Incremental band consolidation failed, using full rebuild:", e);
        await rebuildBandSummary(bandId, overview.chapters, settings);
      }

      await touchStoryUpdated(storyId);
      router.push(`/story/${storyId}/chat?chapter=${newChapter.id}`);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Kapitel" backHref={`/story/${storyId}`} />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-zinc-400">
          Schließt das aktive Kapitel, speichert eine Zusammenfassung und startet
          ein neues — optional mit Eröffnung aus dem vorherigen Kapitel.
        </p>

        <label className="text-xs text-zinc-500">Aktueller Kapiteltitel</label>
        <input
          value={chapterTitle}
          onChange={(e) => setChapterTitle(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
        />

        <label className="text-xs text-zinc-500">Nächster Kapiteltitel</label>
        <input
          value={nextTitle}
          onChange={(e) => setNextTitle(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
        />

        <label className="text-xs text-zinc-500">
          Zeitstrahl (optional, z. B. Stunden 4–8)
        </label>
        <input
          value={phaseHint}
          onChange={(e) => setPhaseHint(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
          placeholder="Stunden 4–8 (Erstkontakt)"
        />

        <fieldset className="space-y-2 rounded-xl border border-surface-border bg-surface-raised/50 p-3">
          <legend className="px-1 text-xs font-medium text-zinc-400">
            Eröffnung im neuen Kapitel
          </legend>
          {CHAPTER_INTRO_OPTIONS.map((opt) => {
            const disabled =
              (opt.id === "last_narration" || opt.id === "last_scene") &&
              !introPreviews.last_narration;
            const preview =
              opt.id === "last_narration"
                ? introPreviews.last_narration
                : opt.id === "last_scene"
                  ? introPreviews.last_scene
                  : null;

            return (
              <label
                key={opt.id}
                className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 ${
                  introMode === opt.id
                    ? "border-accent/50 bg-accent/10"
                    : "border-transparent"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <input
                  type="radio"
                  name="introMode"
                  value={opt.id}
                  checked={introMode === opt.id}
                  disabled={disabled}
                  onChange={() => setIntroMode(opt.id)}
                  className="mt-1 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-zinc-200">{opt.label}</span>
                  <span className="block text-xs text-zinc-500">{opt.hint}</span>
                  {preview ? (
                    <span className="mt-1 block text-xs italic text-zinc-600">
                      „{preview}“
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>

        {introMode === "custom" ? (
          <label className="block text-xs text-zinc-500">
            <span className="mb-1 flex items-center justify-between gap-2">
              <span>Eigene Eröffnung</span>
              <button
                type="button"
                disabled={busy || introAiBusy || !customIntro.trim()}
                onClick={() => void polishCustomIntro()}
                title="KI: Entwurf stilistisch optimieren (Inhalt bleibt erhalten)"
                className="shrink-0 rounded-md border border-violet-800/60 bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-200 disabled:opacity-40"
              >
                {introAiBusy ? "…" : "🎲 KI"}
              </button>
            </span>
            <textarea
              value={customIntro}
              onChange={(e) => setCustomIntro(e.target.value)}
              rows={5}
              placeholder="Erzähler-Text für den Start des neuen Kapitels …"
              disabled={busy || introAiBusy}
              className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base disabled:opacity-60"
            />
            <span className="mt-1 block text-[10px] text-zinc-600">
              Entwurf eingeben, dann 🎲 KI — wie bei Story erstellen.
            </span>
          </label>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={closeChapter}
          className="rounded-xl bg-accent py-3 text-base font-medium text-black disabled:opacity-50"
        >
          {busy ? "Bitte warten …" : "Kapitel schließen & nächstes starten"}
        </button>
        {status ? <p className="text-sm text-zinc-400">{status}</p> : null}
      </div>
    </main>
  );
}
