"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { StoryHubView } from "@/components/story-hub/StoryHubView";
import { createClient } from "@/lib/supabase/client";
import { getStoryConcept } from "@/lib/story/storyOrigin";
import type { StoryCharacterCard } from "@/lib/types";
import {
  deleteChapter,
  getStoryOverview,
  updateStoryTitle,
  type ChapterRow,
} from "@/lib/db/stories";
import { normalizeStoryLocale } from "@/lib/tts/ttsLocaleRouting";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

export default function StoryHubPage() {
  const { t } = useUiLocale();
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getStoryOverview>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(
    null,
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleBusy, setTitleBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getStoryOverview(storyId).then((overview) => {
        setData(overview);
      }),
    [storyId],
  );

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: auth }) => {
        if (!auth.user) {
          router.replace("/login");
          return;
        }
        setUserId(auth.user.id);
        load().catch((e) => setError(String(e)));
      });
  }, [storyId, router, load]);

  const handleDeleteChapter = async (ch: ChapterRow) => {
    if (!data) return;
    const label = ch.title;
    if (
      !confirm(
        t("storyHub.deleteChapterConfirm", { title: label }),
      )
    ) {
      return;
    }
    setDeleteBusyId(ch.id);
    setError(null);
    try {
      const result = await deleteChapter(
        ch.id,
        storyId,
        data.band.id as string,
      );
      await load();
      if (result.deletedActive && result.newActiveId) {
        router.push(`/story/${storyId}/chat?chapter=${result.newActiveId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusyId(null);
    }
  };

  if (error && !data) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title={t("pages.story")} backHref="/" />
        <p className="p-4 text-red-400">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        {t("common.loading")}
      </main>
    );
  }

  const chapters = data.chapters as ChapterRow[];
  const activeChapter = chapters.find((c) => c.status === "active");
  const canDeleteAny = chapters.length > 1;
  const storySettings = (data.story.settings ?? {}) as Record<string, unknown>;
  const storyConcept = getStoryConcept(
    storySettings,
    data.narrator as StoryCharacterCard,
  );

  const saveTitle = async () => {
    setTitleBusy(true);
    setError(null);
    try {
      await updateStoryTitle(storyId, titleDraft);
      await load();
      setEditingTitle(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTitleBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={data.story.title as string} backHref="/" />
      <StoryHubView
        storyId={storyId}
        userId={userId}
        title={data.story.title as string}
        storyConcept={storyConcept}
        coverStoragePath={
          (data.story as { cover_storage_path?: string | null })
            .cover_storage_path
        }
        settings={(data.story.settings ?? {}) as Record<string, unknown>}
        storySettings={data.storySettings}
        bandTitle={(data.band.title as string) ?? "Band"}
        bandSummary={(data.band.band_summary as string | null) ?? null}
        chapters={chapters}
        cast={data.cast}
        storyLocale={normalizeStoryLocale(data.story.locale as string)}
        activeChapterId={activeChapter?.id}
        onCastUpdated={load}
        onLocaleUpdated={load}
        error={error}
        editingTitle={editingTitle}
        titleDraft={titleDraft}
        titleBusy={titleBusy}
        expandedSummaryId={expandedSummaryId}
        deleteBusyId={deleteBusyId}
        canDeleteAny={canDeleteAny}
        onCoverUpdated={(path) => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  story: { ...prev.story, cover_storage_path: path },
                }
              : prev,
          );
        }}
        onStartRename={() => {
          setTitleDraft(data.story.title as string);
          setEditingTitle(true);
        }}
        onTitleDraftChange={setTitleDraft}
        onSaveTitle={saveTitle}
        onCancelRename={() => setEditingTitle(false)}
        onDeleteChapter={handleDeleteChapter}
        onToggleSummary={setExpandedSummaryId}
      />
    </main>
  );
}
