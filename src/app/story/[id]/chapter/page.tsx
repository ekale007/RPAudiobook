"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import {
  createNextChapter,
  getStoryBundle,
  getTurns,
  touchStoryUpdated,
  updateChapterSummaries,
  updateChapterTitle,
  updateBandSummary,
} from "@/lib/db/stories";
import { summarizeChapter } from "@/lib/chapter/summarize";
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
        getStoryBundle(storyId).then((b) => {
          setActiveChapterId(b.activeChapter.id);
          setChapterTitle(b.activeChapter.title);
          setBandId(b.band.id as string);
          const idx =
            Math.max(...b.chapters.map((c) => c.index_in_band), 0) + 1;
          setNextIndex(idx);
          setNextTitle(`Chapter ${idx}`);
        });
      });
  }, [storyId, router]);

  const closeChapter = async () => {
    if (!activeChapterId || !bandId) return;
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setStatus("Add OpenRouter key in Settings to summarize.");
      return;
    }
    setBusy(true);
    setStatus("Summarizing chapter…");
    try {
      if (chapterTitle.trim()) {
        await updateChapterTitle(activeChapterId, chapterTitle.trim());
      }

      const turns: TurnRow[] = await getTurns(activeChapterId);
      const chatTurns: ChatTurn[] = turns.map((t) => ({
        role: t.role as ChatTurn["role"],
        content: t.content,
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

      const title =
        nextTitle.trim() || `Chapter ${nextIndex}`;
      const newChapter = await createNextChapter(
        bandId,
        nextIndex,
        title,
        phaseHint.trim() || undefined,
      );

      if (summary.length > 100) {
        await updateBandSummary(bandId, summary.slice(0, 2000));
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
      <AppHeader title="Chapter" backHref={`/story/${storyId}`} />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-zinc-400">
          Closes the active chapter, saves an AI summary to Supabase, and opens a
          new chapter for play.
        </p>
        <label className="text-xs text-zinc-500">Current chapter title</label>
        <input
          value={chapterTitle}
          onChange={(e) => setChapterTitle(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
        />
        <label className="text-xs text-zinc-500">Next chapter title</label>
        <input
          value={nextTitle}
          onChange={(e) => setNextTitle(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
        />
        <label className="text-xs text-zinc-500">
          Timeline hint (optional, e.g. Hours 4–8)
        </label>
        <input
          value={phaseHint}
          onChange={(e) => setPhaseHint(e.target.value)}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
          placeholder="Hours 4-8 (First Contact)"
        />
        <button
          type="button"
          disabled={busy}
          onClick={closeChapter}
          className="rounded-xl bg-accent py-3 text-base font-medium text-black disabled:opacity-50"
        >
          {busy ? "Working…" : "Close chapter & start next"}
        </button>
        {status ? <p className="text-sm text-zinc-400">{status}</p> : null}
      </div>
    </main>
  );
}
