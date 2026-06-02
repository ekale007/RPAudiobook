"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ChatView } from "@/components/ChatView";
import { createClient } from "@/lib/supabase/client";
import { getStoryBundle } from "@/lib/db/stories";
import { isLlmReady } from "@/lib/storage/openRouterSettings";
import { isTtsReady, loadTtsSettings } from "@/lib/storage/ttsSettings";
import { useServerCapabilities } from "@/lib/server/useServerCapabilities";
import Link from "next/link";
import { ProtagonistSetupModal } from "@/components/story-hub/ProtagonistSetupModal";
import { needsProtagonistSetup } from "@/lib/story/protagonist";
import type { StorySettings } from "@/lib/types";

function StoryChatInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = params.id as string;
  const serverCaps = useServerCapabilities();
  const chapterParam = searchParams.get("chapter") ?? undefined;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof getStoryBundle>
  > | null>(null);
  const [storySettings, setStorySettings] = useState<StorySettings | null>(
    null,
  );

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
          setStorySettings(b.storySettings);
          setReady(true);
        })
        .catch((e) => setError(String(e)));
    });
  }, [storyId, chapterParam, router]);

  const hasKey = typeof window !== "undefined" && isLlmReady();
  const hasTts =
    typeof window !== "undefined" && isTtsReady(loadTtsSettings());
  const ttsProvider = loadTtsSettings().provider;

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

  const bandSummary = (bundle.band.band_summary as string | null)?.trim();
  const priorSummaries = bandSummary
    ? null
    : bundle.chapters
        .filter(
          (c) =>
            c.status === "closed" &&
            c.chapter_summary &&
            c.index_in_band < bundle.activeChapter.index_in_band,
        )
        .map((c) => `### ${c.title}\n${c.chapter_summary}`)
        .join("\n\n") || null;

  const readOnly = bundle.activeChapter.status !== "active";
  const showProtagonistSetup =
    !readOnly &&
    storySettings &&
    needsProtagonistSetup(storySettings);

  return (
    <main className="flex h-dvh flex-col">
      <AppHeader
        title={bundle.activeChapter.title}
        backHref={`/story/${storyId}`}
      />
      {readOnly ? (
        <p className="border-b border-zinc-700 bg-zinc-900 px-4 py-2 text-center text-xs text-zinc-400">
          Geschlossenes Kapitel — nur lesen &amp; anhören.{" "}
          <Link href={`/story/${storyId}`} className="text-accent underline">
            Alle Kapitel
          </Link>
          {bundle.chapters.some((c) => c.status === "active") ? (
            <>
              {" · "}
              <Link
                href={`/story/${storyId}/chat?chapter=${bundle.chapters.find((c) => c.status === "active")!.id}`}
                className="text-accent underline"
              >
                Aktives Kapitel
              </Link>
            </>
          ) : null}
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
          </Link>
          {ttsProvider === "local" && !serverCaps.serverTts
            ? " (PC: npm run tts:server)"
            : null}
        </p>
      ) : null}
      {showProtagonistSetup && storySettings ? (
        <ProtagonistSetupModal
          open
          storyId={storyId}
          storyLocale={(bundle.story.locale as string) ?? "de"}
          storySettings={storySettings}
          onComplete={(merged) => {
            setStorySettings(merged);
            setBundle((prev) =>
              prev ? { ...prev, storySettings: merged } : prev,
            );
          }}
        />
      ) : null}
      <ChatView
        storyId={storyId}
        chapterId={bundle.activeChapter.id}
        character={bundle.narrator}
        cast={bundle.allCast}
        storySettings={storySettings ?? bundle.storySettings}
        loreEntries={bundle.loreEntries}
        chapter={bundle.activeChapter}
        bandSummary={bandSummary || null}
        priorChapterSummaries={priorSummaries}
        chapterTitle={bundle.activeChapter.title}
        phaseHint={bundle.activeChapter.phase_hint ?? null}
        chapterIndex={bundle.activeChapter.index_in_band}
        closedChapterCount={
          bundle.chapters.filter((c) => c.status === "closed").length
        }
        readOnly={readOnly}
        storyLocale={(bundle.story.locale as string) ?? "de"}
      />
    </main>
  );
}

export function StoryChatClient() {
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
