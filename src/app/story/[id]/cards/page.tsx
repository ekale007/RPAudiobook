"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import {
  getStoryOverview,
  listCharacters,
  updateCharacterCard,
  type CharacterRow,
} from "@/lib/db/stories";
import type { WryTourCharacter } from "@/lib/types";

type CardField =
  | "name"
  | "description"
  | "personality"
  | "scenario"
  | "first_mes"
  | "system_prompt"
  | "post_history_instructions";

const FIELDS: { key: CardField; label: string; rows: number }[] = [
  { key: "name", label: "Name", rows: 1 },
  { key: "description", label: "Beschreibung", rows: 3 },
  { key: "personality", label: "Persönlichkeit", rows: 2 },
  { key: "scenario", label: "Szenario", rows: 3 },
  { key: "first_mes", label: "Eröffnung (first_mes)", rows: 5 },
  { key: "system_prompt", label: "System-Prompt", rows: 5 },
  {
    key: "post_history_instructions",
    label: "Post-History",
    rows: 2,
  },
];

function roleLabel(role: string): string {
  if (role === "narrator") return "Erzähler";
  return "Cast";
}

export default function StoryCharacterCardsPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState("");
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, WryTourCharacter>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const overview = await getStoryOverview(storyId);
    setStoryTitle(overview.story.title as string);
    const rows = await listCharacters(storyId);
    const all = rows.filter(
      (c) => c.role === "narrator" || c.role === "cast",
    );
    setCharacters(all);
    const next: Record<string, WryTourCharacter> = {};
    for (const c of all) {
      next[c.id] = structuredClone(c.card_json);
    }
    setDrafts(next);
    setOpenId((prev) => prev ?? all[0]?.id ?? null);
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

  const patchDraft = (id: string, field: CardField, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const save = async (c: CharacterRow) => {
    const draft = drafts[c.id];
    if (!draft) return;
    setBusyId(c.id);
    setError(null);
    setMessage(null);
    try {
      await updateCharacterCard(c.id, storyId, draft);
      setMessage(`„${draft.name || c.name}“ gespeichert.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
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
      <AppHeader title="Charakterkarten" backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <p className="text-xs text-zinc-500">{storyTitle}</p>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}

        <ul className="flex flex-col gap-2">
          {characters.map((c) => {
            const draft = drafts[c.id];
            const open = openId === c.id;
            if (!draft) return null;
            return (
              <li
                key={c.id}
                className="overflow-hidden rounded-lg border border-surface-border bg-surface-raised"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <span className="text-sm font-medium text-zinc-100">
                    {draft.name || c.name}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {roleLabel(c.role)} · {open ? "▲" : "▼"}
                  </span>
                </button>
                {open ? (
                  <div className="space-y-2 border-t border-surface-border/60 px-3 py-3">
                    {FIELDS.map(({ key, label, rows }) => (
                      <label
                        key={key}
                        className="block text-[11px] text-zinc-500"
                      >
                        {label}
                        {rows === 1 ? (
                          <input
                            value={String(draft[key] ?? "")}
                            onChange={(e) =>
                              patchDraft(c.id, key, e.target.value)
                            }
                            className="mt-0.5 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                          />
                        ) : (
                          <textarea
                            value={String(draft[key] ?? "")}
                            onChange={(e) =>
                              patchDraft(c.id, key, e.target.value)
                            }
                            rows={rows}
                            className="mt-0.5 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm leading-relaxed"
                          />
                        )}
                      </label>
                    ))}
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => save(c)}
                      className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black disabled:opacity-50"
                    >
                      {busyId === c.id ? "Speichert …" : "Karte speichern"}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

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
