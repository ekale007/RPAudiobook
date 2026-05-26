"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ChatView } from "@/components/ChatView";
import { createClient } from "@/lib/supabase/client";
import { getStoryBundle } from "@/lib/db/stories";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import { isTtsReady, loadTtsSettings } from "@/lib/storage/ttsSettings";
import Link from "next/link";

function StoryChatInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = params.id as string;
  const chapterParam = searchParams.get("chapter") ?? undefined;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof getStoryBundle>
  > | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      getStoryBundle(storyId, chapterParam)
        .then((b) => {
          setBundle(b);
          setReady(true);
        })
        .catch((e) => setError(String(e)));
    });
  }, [storyId, chapterParam, router]);

  const hasKey = typeof window !== "undefined" && !!loadOpenRouterSettings();
  const hasTts =
    typeof window !== "undefined" && isTtsReady(loadTtsSettings());

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="Chat" backHref={`/story/${storyId}`} />
        <p className="p-4 text-red-400">{error}</p>
      </main>
    );
  }

  if (!ready || !bundle) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        Loading story…
      </main>
    );
  }

  const priorSummaries = bundle.chapters
    .filter(
      (c) =>
        c.status === "closed" &&
        c.chapter_summary &&
        c.index_in_band < bundle.activeChapter.index_in_band,
    )
    .map((c) => `${c.title}: ${c.chapter_summary}`)
    .join("\n\n");

  const readOnly = bundle.activeChapter.status !== "active";

  return (
    <main className="flex h-dvh flex-col">
      <AppHeader
        title={bundle.activeChapter.title}
        backHref={`/story/${storyId}`}
      />
      {readOnly ? (
        <p className="border-b border-zinc-700 bg-zinc-900 px-4 py-2 text-center text-xs text-zinc-400">
          Archived chapter — read only.{" "}
          <Link href={`/story/${storyId}`} className="text-accent underline">
            Open active chapter
          </Link>
        </p>
      ) : null}
      {!hasKey ? (
        <p className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-center text-xs text-amber-200">
          <Link href="/settings" className="underline">
            Add OpenRouter API key
          </Link>{" "}
          to send messages.
        </p>
      ) : null}
      {hasKey && !hasTts ? (
        <p className="border-b border-surface-border bg-surface-raised px-4 py-2 text-center text-xs text-zinc-400">
          <Link href="/settings" className="text-accent underline">
            Configure TTS
          </Link>{" "}
          (PC: npm run tts:server)
        </p>
      ) : null}
      <ChatView
        storyId={storyId}
        chapterId={bundle.activeChapter.id}
        character={bundle.narrator}
        cast={bundle.cast}
        storySettings={bundle.storySettings}
        loreEntries={bundle.loreEntries}
        chapter={bundle.activeChapter}
        bandSummary={bundle.band.band_summary as string | null}
        priorChapterSummaries={priorSummaries || null}
        readOnly={readOnly}
      />
    </main>
  );
}

export default function StoryChatPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-zinc-400">
          Loading…
        </main>
      }
    >
      <StoryChatInner />
    </Suspense>
  );
}
