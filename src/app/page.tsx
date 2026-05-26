"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { importWhenDawnBreaks, listStories } from "@/lib/db/stories";
import { loadWhenDawnBreaksSeed } from "@/lib/import/wrytour";
import type { User } from "@supabase/supabase-js";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stories, setStories] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabaseOk = isSupabaseConfigured();

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
    listStories()
      .then(setStories)
      .catch((e) => setMessage(String(e)));
  }, [user]);

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    setMessage(null);
    try {
      const pack = loadWhenDawnBreaksSeed();
      const { storyId } = await importWhenDawnBreaks(user.id, pack);
      const list = await listStories();
      setStories(list);
      setMessage("Story imported.");
      window.location.href = `/story/${storyId}`;
    } catch (e) {
      setMessage(String(e));
    } finally {
      setImporting(false);
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
      <AppHeader title="Your stories" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <button
          type="button"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            setUser(null);
            setStories([]);
          }}
          className="text-right text-xs text-zinc-500"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="w-full rounded-xl border border-accent/40 bg-accent/10 py-3 text-sm font-medium text-accent"
        >
          {importing ? "Importing…" : "Import When Dawn Breaks"}
        </button>

        {message ? (
          <p className="text-center text-sm text-zinc-400">{message}</p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {stories.map((s) => (
            <li key={s.id}>
              <Link
                href={`/story/${s.id}`}
                className="block rounded-xl border border-surface-border bg-surface-raised px-4 py-3"
              >
                <span className="font-medium">{s.title}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  Story hub · chapters · export
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {stories.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            No stories yet. Import the seed pack to start.
          </p>
        ) : null}
      </div>
    </main>
  );
}
