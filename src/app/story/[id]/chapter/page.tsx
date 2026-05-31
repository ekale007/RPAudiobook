"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import {
  CHAPTER_INTRO_OPTIONS,
  getLastAssistantTurn,
  getTrailingAssistantTurns,
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
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        getStoryBundle(storyId).then(async (b) => {
          setActiveChapterId(b.activeChapter.id);
          setChapterTitle(b.activeChapter.title);
          setBandId(b.band.id as string);
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
      });
  }, [storyId, router]);

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

      const overview = await getStoryBundle(storyId);
      await rebuildBandSummary(bandId, overview.chapters, settings);

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
          <>
            <label className="text-xs text-zinc-500">Eigene Eröffnung</label>
            <textarea
              value={customIntro}
              onChange={(e) => setCustomIntro(e.target.value)}
              rows={5}
              placeholder="Erzähler-Text für den Start des neuen Kapitels …"
              className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
            />
          </>
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
