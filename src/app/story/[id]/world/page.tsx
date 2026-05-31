"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import {
  listLorebooksForStory,
  updateStoryLorebook,
} from "@/lib/db/stories";
import type { LoreEntry, WryTourLorebook } from "@/lib/types";

function parseKeysInput(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function keysToInput(keys: string[]): string {
  return keys.join(", ");
}

export default function StoryWorldPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lorebookId, setLorebookId] = useState<string | null>(null);
  const [book, setBook] = useState<WryTourLorebook | null>(null);

  const load = useCallback(async () => {
    const rows = await listLorebooksForStory(storyId);
    if (!rows.length) {
      setLorebookId(null);
      setBook(null);
      return;
    }
    const first = rows[0] as {
      id: string;
      book_json: WryTourLorebook;
    };
    setLorebookId(first.id);
    setBook(structuredClone(first.book_json));
  }, [storyId]);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        load()
          .catch((e) => setError(String(e)))
          .finally(() => setLoading(false));
      });
  }, [load, router]);

  const updateEntry = (index: number, patch: Partial<LoreEntry>) => {
    if (!book) return;
    const entries = book.entries.map((e, i) =>
      i === index ? { ...e, ...patch } : e,
    );
    setBook({ ...book, entries });
  };

  const addEntry = () => {
    if (!book) return;
    const entries = [
      ...book.entries,
      {
        keys: [],
        content: "",
        enabled: true,
        order: (book.entries.length + 1) * 10,
      },
    ];
    setBook({ ...book, entries });
  };

  const removeEntry = (index: number) => {
    if (!book) return;
    setBook({
      ...book,
      entries: book.entries.filter((_, i) => i !== index),
    });
  };

  const save = async () => {
    if (!book || !lorebookId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const normalized: WryTourLorebook = {
        ...book,
        name: book.name.trim() || "World",
        entries: book.entries.map((e, i) => ({
          ...e,
          keys: Array.isArray(e.keys) ? e.keys : parseKeysInput(String(e.keys)),
          order: e.order ?? (i + 1) * 10,
          enabled: e.enabled !== false,
        })),
      };
      await updateStoryLorebook(lorebookId, storyId, normalized);
      setBook(normalized);
      setMessage("Lorebook gespeichert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-zinc-400">
        Laden …
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Welt & Lore" backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}

        {!book ? (
          <p className="text-sm text-zinc-500">
            Kein Lorebook an dieser Story. Importiere eine Bibliotheks-Vorlage
            oder lege eine Story im Editor an.
          </p>
        ) : (
          <>
            <label className="block text-xs text-zinc-400">
              Lorebook-Name
              <input
                value={book.name}
                onChange={(e) => setBook({ ...book, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Beschreibung (optional)
              <textarea
                value={book.description ?? ""}
                onChange={(e) =>
                  setBook({ ...book, description: e.target.value })
                }
                rows={2}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>

            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-200">
                Einträge ({book.entries.length})
              </h2>
              <button
                type="button"
                onClick={addEntry}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
              >
                + Eintrag
              </button>
            </div>

            <ul className="flex flex-col gap-3">
              {book.entries.map((entry, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-surface-border bg-surface-raised p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-400">
                      #{index + 1}
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <input
                        type="checkbox"
                        checked={entry.enabled !== false}
                        onChange={(e) =>
                          updateEntry(index, { enabled: e.target.checked })
                        }
                      />
                      Aktiv
                    </label>
                  </div>
                  <label className="block text-[11px] text-zinc-500">
                    Keys (kommagetrennt)
                    <input
                      value={keysToInput(entry.keys ?? [])}
                      onChange={(e) =>
                        updateEntry(index, {
                          keys: parseKeysInput(e.target.value),
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="mt-2 block text-[11px] text-zinc-500">
                    Inhalt
                    <textarea
                      value={entry.content}
                      onChange={(e) =>
                        updateEntry(index, { content: e.target.value })
                      }
                      rows={4}
                      className="mt-0.5 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm leading-relaxed"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    className="mt-2 text-[11px] text-red-400/90 underline"
                  >
                    Eintrag entfernen
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="sticky bottom-2 rounded-xl bg-accent py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy ? "Speichert …" : "Lorebook speichern"}
            </button>
          </>
        )}

        <Link
          href={`/story/${storyId}`}
          className="text-center text-xs text-zinc-500 underline"
        >
          Zurück zum Story-Hub
        </Link>
      </div>
    </main>
  );
}
