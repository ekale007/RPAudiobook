"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LoreEntryCard } from "@/components/story-editor/LoreEntryCard";
import { useStorySession } from "@/lib/story/useStorySession";
import {
  getStoryOverview,
  listLorebooksForStory,
  updateStoryLorebook,
} from "@/lib/db/stories";
import type { LoreEntry, StoryLorebook } from "@/lib/types";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import { randomizeStoryField, emptyStoryDraft } from "@/lib/story/storyFieldAi";

function parseKeysInput(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
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
  const [book, setBook] = useState<StoryLorebook | null>(null);
  const [storyConcept, setStoryConcept] = useState<string | null>(null);
  const [storyLocale, setStoryLocale] = useState<"de" | "en">("de");
  const [busyEntry, setBusyEntry] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const { authReady } = useStorySession(router);

  const load = useCallback(async () => {
    const rows = await listLorebooksForStory(storyId);
    if (!rows.length) {
      setLorebookId(null);
      setBook(null);
      setDirty(false);
      return;
    }
    const first = rows[0] as {
      id: string;
      book_json: StoryLorebook;
    };
    setLorebookId(first.id);
    setBook(structuredClone(first.book_json));
    setDirty(false);
  }, [storyId]);

  useEffect(() => {
    if (!authReady) return;
    // Story concept for the AI context.
    getStoryOverview(storyId)
      .then((overview) => {
        const settings = (overview.story.settings ?? {}) as Record<string, unknown>;
        const locale = (overview.story.locale as string) ?? "de";
        setStoryLocale(locale === "en" ? "en" : "de");
        setStoryConcept(
          (settings.storyConcept as string | null) ??
            (settings.concept as string | null) ??
            null,
        );
      })
      .catch(() => {});
    load()
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [authReady, load, storyId]);

  const updateEntry = (index: number, patch: Partial<LoreEntry>) => {
    if (!book) return;
    const entries = book.entries.map((e, i) =>
      i === index ? { ...e, ...patch } : e,
    );
    setBook({ ...book, entries });
    setDirty(true);
  };

  const addEntry = () => {
    if (!book) return;
    const entries = [
      ...book.entries,
      {
        keys: [],
        content: "",
        comment: "",
        enabled: true,
        order: (book.entries.length + 1) * 10,
      },
    ];
    setBook({ ...book, entries });
    setDirty(true);
  };

  const addEntryWithAi = async () => {
    const settings = loadOpenRouterSettings();
    if (!settings) {
      setError("Kein LLM-Setup gefunden — bitte in den Einstellungen prüfen.");
      return;
    }
    if (!book) return;
    setBusyEntry("__new__");
    setError(null);
    try {
      const draft = emptyStoryDraft(storyLocale);
      const concept = storyConcept ?? "";
      const brief = { concept, locale: storyLocale, draft };
      const idx = book.entries.length;

      const [title, keys, content] = await Promise.all([
        randomizeStoryField(settings, brief, {
          scope: "loreEntry",
          index: idx,
          field: "comment",
        }),
        randomizeStoryField(settings, brief, {
          scope: "loreEntry",
          index: idx,
          field: "keys",
        }),
        randomizeStoryField(settings, brief, {
          scope: "loreEntry",
          index: idx,
          field: "content",
        }),
      ]);

      const newEntry: LoreEntry = {
        comment: title,
        keys: parseKeysInput(keys),
        content: content || title,
        enabled: true,
        order: (idx + 1) * 10,
      };
      setBook({ ...book, entries: [...book.entries, newEntry] });
      setDirty(true);
      setMessage("🎲 KI-Eintrag generiert — bitte prüfen und speichern.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyEntry(null);
    }
  };

  const aiSuggestField = async (index: number, field: "comment" | "keys" | "content") => {
    const settings = loadOpenRouterSettings();
    if (!settings || !book) return;
    setBusyEntry(`${index}:${field}`);
    setError(null);
    try {
      const draft = emptyStoryDraft(storyLocale);
      const brief = { concept: storyConcept ?? "", locale: storyLocale, draft };
      const value = await randomizeStoryField(settings, brief, {
        scope: "loreEntry",
        index,
        field,
      });
      if (field === "keys") {
        updateEntry(index, { keys: parseKeysInput(value) });
      } else {
        updateEntry(index, { [field]: value });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyEntry(null);
    }
  };

  const moveEntry = (index: number, dir: -1 | 1) => {
    if (!book) return;
    const entries = [...book.entries];
    const target = index + dir;
    if (target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    setBook({ ...book, entries });
    setDirty(true);
  };

  const removeEntry = (index: number) => {
    if (!book) return;
    setBook({
      ...book,
      entries: book.entries.filter((_, i) => i !== index),
    });
    setDirty(true);
  };

  const save = async () => {
    if (!book || !lorebookId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const normalized: StoryLorebook = {
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
      setDirty(false);
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
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 pb-24">
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}

        {!book ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              Kein Lorebook an dieser Story. Importiere eine
              Bibliotheks-Vorlage oder lege eine Story im Editor an.
            </p>
            <Link
              href={`/story/${storyId}`}
              className="text-center text-xs text-zinc-500 underline"
            >
              Zurück zum Story-Hub
            </Link>
          </div>
        ) : (
          <>
            <label className="block text-xs text-zinc-400">
              Lorebook-Name
              <input
                value={book.name}
                onChange={(e) => {
                  setBook({ ...book, name: e.target.value });
                  setDirty(true);
                }}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Beschreibung (optional)
              <textarea
                value={book.description ?? ""}
                onChange={(e) => {
                  setBook({ ...book, description: e.target.value });
                  setDirty(true);
                }}
                rows={2}
                className="mt-1 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>

            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-200">
                Einträge ({book.entries.length})
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyEntry !== null}
                  onClick={() => void addEntryWithAi()}
                  className="rounded-md border border-violet-800/60 bg-violet-950/40 px-2 py-1 text-xs text-violet-200 disabled:opacity-50"
                  title="KI generiert Titel + Keywords + Inhalt in einem Rutsch"
                >
                  {busyEntry === "__new__" ? "…" : "🎲 KI-Eintrag"}
                </button>
                <button
                  type="button"
                  onClick={addEntry}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                >
                  + Leer
                </button>
              </div>
            </div>

            <ul className="flex flex-col gap-3">
              {book.entries.map((entry, index) => (
                <LoreEntryCard
                  key={index}
                  index={index}
                  entry={entry}
                  total={book.entries.length}
                  busyField={busyEntry}
                  onChange={(patch) => updateEntry(index, patch)}
                  onRemove={() => removeEntry(index)}
                  onMove={(dir) => moveEntry(index, dir)}
                  onAiSuggest={(field) => void aiSuggestField(index, field)}
                />
              ))}
            </ul>

            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="sticky bottom-2 rounded-xl bg-accent py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy ? "Speichert …" : dirty ? "Lorebook speichern (unge­speichert)" : "Lorebook speichern"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}