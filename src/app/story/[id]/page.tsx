"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import { getStoryOverview, updateStorySettings } from "@/lib/db/stories";
import type { ChatMode } from "@/lib/types";

export default function StoryHubPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getStoryOverview>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("narrator");
  const [modeBusy, setModeBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: auth }) => {
        if (!auth.user) {
          router.replace("/login");
          return;
        }
        getStoryOverview(storyId)
          .then((overview) => {
            setData(overview);
            setChatMode(overview.storySettings.chatMode ?? "narrator");
          })
          .catch((e) => setError(String(e)));
      });
  }, [storyId, router]);

  const setMode = async (mode: ChatMode) => {
    setModeBusy(true);
    setError(null);
    try {
      await updateStorySettings(storyId, { chatMode: mode });
      setChatMode(mode);
    } catch (e) {
      setError(String(e));
    } finally {
      setModeBusy(false);
    }
  };

  if (error && !data) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="Story" backHref="/" />
        <p className="p-4 text-red-400">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        Loading…
      </main>
    );
  }

  const activeId = data.chapters.find((c) => c.status === "active")?.id;

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={data.story.title as string} backHref="/" />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 pb-8">
        <Link
          href={`/story/${storyId}/chat${activeId ? `?chapter=${activeId}` : ""}`}
          className="rounded-xl bg-accent py-3 text-center font-medium text-black"
        >
          Continue playing
        </Link>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-accent">Play mode</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Narrator only, or group chat where cast members can speak (Naya,
            Lucifer, …).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={modeBusy}
              onClick={() => setMode("narrator")}
              className={`flex-1 rounded-lg py-2 text-sm ${
                chatMode === "narrator"
                  ? "bg-accent text-black"
                  : "border border-surface-border text-zinc-400"
              }`}
            >
              Narrator
            </button>
            <button
              type="button"
              disabled={modeBusy}
              onClick={() => setMode("group")}
              className={`flex-1 rounded-lg py-2 text-sm ${
                chatMode === "group"
                  ? "bg-accent text-black"
                  : "border border-surface-border text-zinc-400"
              }`}
            >
              Group chat
            </button>
          </div>
          {chatMode === "group" ? (
            <Link
              href={`/story/${storyId}/voices`}
              className="mt-3 block text-center text-xs text-accent underline"
            >
              Assign Kokoro voices per character
            </Link>
          ) : null}
        </section>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-accent">
            {(data.band.title as string) ?? "Volume"}
          </h2>
          {data.band.band_summary ? (
            <p className="text-xs leading-relaxed text-zinc-400">
              {data.band.band_summary as string}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">No volume summary yet.</p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Chapters</h2>
          <ul className="flex flex-col gap-2">
            {data.chapters.map((ch) => (
              <li key={ch.id}>
                <Link
                  href={`/story/${storyId}/chat?chapter=${ch.id}`}
                  className={`block rounded-xl border px-4 py-3 ${
                    ch.status === "active"
                      ? "border-accent/50 bg-accent/10"
                      : "border-surface-border bg-surface-raised"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{ch.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {ch.status === "active" ? "Active" : "Closed"}
                    </span>
                  </div>
                  {ch.phase_hint ? (
                    <p className="mt-1 text-xs text-zinc-500">{ch.phase_hint}</p>
                  ) : null}
                  {ch.chapter_summary ? (
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                      {ch.chapter_summary}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Cast</h2>
          <ul className="flex flex-wrap gap-2">
            {data.cast.map((c) => (
              <li
                key={c.id}
                className="rounded-full border border-surface-border px-3 py-1 text-xs text-zinc-400"
              >
                {c.name}{" "}
                <span className="text-zinc-600">({c.role})</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-2 border-t border-surface-border pt-4">
          <Link
            href={`/story/${storyId}/voices`}
            className="rounded-xl border border-surface-border py-2.5 text-center text-sm text-zinc-300"
          >
            Character voices (TTS)
          </Link>
          <Link
            href={`/story/${storyId}/chapter`}
            className="rounded-xl border border-surface-border py-2.5 text-center text-sm text-zinc-300"
          >
            Close chapter &amp; start next
          </Link>
          <Link
            href={`/story/${storyId}/export`}
            className="rounded-xl border border-surface-border py-2.5 text-center text-sm text-zinc-300"
          >
            Export cards &amp; lorebooks
          </Link>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </main>
  );
}
