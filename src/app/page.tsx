"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import {
  StoryLibraryShelf,
  StoryListCard,
} from "@/components/StoryHomeSections";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deleteStory,
  DuplicateLibraryImportError,
  importFromLibraryTemplate,
  isStoryArchived,
  listStories,
  setStoryArchived,
  updateStoryTitle,
  type StoryRow,
} from "@/lib/db/stories";
import type { LibraryTemplateId } from "@/lib/story/libraryTemplates";
import {
  getLibraryTemplateId,
  getStoryOrigin,
  storyOriginLabel,
} from "@/lib/story/storyOrigin";
import type { User } from "@supabase/supabase-js";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<LibraryTemplateId | null>(
    null,
  );
  const [showArchived, setShowArchived] = useState(false);
  const [busyStoryId, setBusyStoryId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const supabaseOk = isSupabaseConfigured();

  const refreshStories = async (includeArchived = showArchived) => {
    if (!user) return;
    const rows = await listStories(includeArchived);
    setStories(rows);
  };

  useEffect(() => {
    if (!supabaseOk) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabaseOk]);

  useEffect(() => {
    if (!user) return;
    listStories(showArchived)
      .then(setStories)
      .catch((e) => setMessage(String(e)));
  }, [user, showArchived]);

  const handleLibraryImport = async (templateId: LibraryTemplateId) => {
    if (!user) return;
    setImportingId(templateId);
    setMessage(null);
    try {
      const { storyId } = await importFromLibraryTemplate(user.id, templateId);
      window.location.href = `/story/${storyId}`;
    } catch (e) {
      if (e instanceof DuplicateLibraryImportError) {
        const go = window.confirm(
          `„${e.existingTitle}“ hast du schon aus der Bibliothek importiert.\n\nZur bestehenden Story wechseln?`,
        );
        if (go) window.location.href = `/story/${e.existingStoryId}`;
        setImportingId(null);
        return;
      }
      setMessage(String(e));
      setImportingId(null);
    }
  };

  if (!supabaseOk) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="HörbuchKI" />
        <div className="flex flex-1 flex-col justify-center gap-4 p-6 text-center">
          <p className="text-zinc-300">
            Copy <code className="text-accent">.env.example</code> to{" "}
            <code className="text-accent">.env.local</code> and add your
            Supabase URL + anon key.
          </p>
          <Link href="/settings" className="text-accent underline">
            Settings
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        Loading…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="HörbuchKI" />
        <div className="flex flex-1 flex-col justify-center gap-6 p-6">
          <p className="text-center text-zinc-300">
            Sign in to save stories in Supabase. Your OpenRouter key stays on
            this device only.
          </p>
          <Link
            href="/login"
            className="rounded-xl bg-accent py-3 text-center font-medium text-black"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader
        title="HörbuchKI"
        centerSlot={
          <Link
            href="/story/new"
            className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-black shadow-sm sm:px-4 sm:text-xs"
          >
            + Neue Story
          </Link>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-8 pt-3 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-200">Deine Geschichten</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="scale-90"
              />
              Archiv
            </label>
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                setUser(null);
                setStories([]);
              }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400"
            >
              Sign out
            </button>
          </div>
        </div>

        {message ? (
          <p className="mb-2 text-center text-xs text-zinc-400">{message}</p>
        ) : null}

        <ul className="flex flex-col gap-1.5">
          {stories.map((s) => (
            <li key={s.id}>
              <StoryListCard
                story={s}
                libraryTemplateId={getLibraryTemplateId(s.settings)}
                originLabel={storyOriginLabel(getStoryOrigin(s.settings))}
                busy={busyStoryId === s.id}
                renaming={renamingId === s.id}
                renameDraft={renameDraft}
                onRenameDraftChange={setRenameDraft}
                onStartRename={() => {
                  setRenamingId(s.id);
                  setRenameDraft(s.title);
                }}
                onCancelRename={() => setRenamingId(null)}
                onSaveRename={async () => {
                  setBusyStoryId(s.id);
                  setMessage(null);
                  try {
                    await updateStoryTitle(s.id, renameDraft);
                    setRenamingId(null);
                    await refreshStories();
                  } catch (e) {
                    setMessage(String(e));
                  } finally {
                    setBusyStoryId(null);
                  }
                }}
                onArchive={async () => {
                  setBusyStoryId(s.id);
                  setMessage(null);
                  try {
                    const archived = isStoryArchived(s.settings);
                    await setStoryArchived(s.id, !archived);
                    await refreshStories();
                  } catch (e) {
                    setMessage(String(e));
                  } finally {
                    setBusyStoryId(null);
                  }
                }}
                onDelete={async () => {
                  const ok = window.confirm(
                    `Delete story "${s.title}" permanently? This cannot be undone.`,
                  );
                  if (!ok) return;
                  setBusyStoryId(s.id);
                  setMessage(null);
                  try {
                    await deleteStory(s.id);
                    await refreshStories();
                  } catch (e) {
                    setMessage(String(e));
                  } finally {
                    setBusyStoryId(null);
                  }
                }}
                isArchived={isStoryArchived(s.settings)}
              />
            </li>
          ))}
        </ul>

        {stories.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            Noch keine Geschichten — tippe oben auf{" "}
            <strong className="font-medium text-zinc-400">+ Neue Story</strong>{" "}
            oder wähle unten aus der Bibliothek.
          </p>
        ) : null}

        <StoryLibraryShelf
          importingId={importingId}
          onImport={handleLibraryImport}
        />
      </div>
    </main>
  );
}
