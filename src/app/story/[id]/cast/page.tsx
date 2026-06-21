"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useStorySession } from "@/lib/story/useStorySession";
import {
  getStoryOverview,
  updateCharacterManual,
  type CharacterRow,
} from "@/lib/db/stories";

export default function StoryCastPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [storyTitle, setStoryTitle] = useState("");
  const [cast, setCast] = useState<CharacterRow[]>([]);
  const [charDrafts, setCharDrafts] = useState<
    Record<string, { memory: string; archived: boolean; reason: string }>
  >({});

  const load = useCallback(async () => {
    const overview = await getStoryOverview(storyId);
    setStoryTitle(overview.story.title as string);
    const members = overview.cast.filter((c) => c.role === "cast");
    setCast(members);

    const drafts: Record<
      string,
      { memory: string; archived: boolean; reason: string }
    > = {};
    for (const c of members) {
      drafts[c.id] = {
        memory: c.character_memory ?? "",
        archived: c.status === "archived",
        reason: c.archived_reason ?? "",
      };
    }
    setCharDrafts(drafts);
  }, [storyId]);

  const { authReady } = useStorySession(router);

  useEffect(() => {
    if (!authReady) return;
    load()
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [authReady, load]);

  const saveCharacter = async (c: CharacterRow) => {
    const draft = charDrafts[c.id];
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await updateCharacterManual(c.id, storyId, {
        character_memory: draft.memory,
        status: draft.archived ? "archived" : "active",
        archived_reason: draft.archived ? draft.reason || "manual" : null,
      });
      await load();
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
      <AppHeader title={storyTitle || "Cast"} backHref={`/story/${storyId}`} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
        <div>
          <h1 className="text-sm font-medium text-zinc-200">
            Figuren &amp; Erinnerungen
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Was die Story über jede Figur weiß — Reihenfolge wie bei der
            Erstellung (Hauptcharaktere oben).
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {cast.map((c) => {
            const draft = charDrafts[c.id];
            if (!draft) return null;
            return (
              <li
                key={c.id}
                className="rounded-xl border border-surface-border bg-surface-raised p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    {c.name}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <input
                      type="checkbox"
                      checked={draft.archived}
                      onChange={(e) =>
                        setCharDrafts((prev) => ({
                          ...prev,
                          [c.id]: {
                            ...prev[c.id]!,
                            archived: e.target.checked,
                          },
                        }))
                      }
                    />
                    Archiviert
                  </label>
                </div>
                {c.card_json.personality ? (
                  <p className="mb-2 text-[11px] text-zinc-500">
                    {c.card_json.personality}
                  </p>
                ) : null}
                <textarea
                  value={draft.memory}
                  onChange={(e) =>
                    setCharDrafts((prev) => ({
                      ...prev,
                      [c.id]: { ...prev[c.id]!, memory: e.target.value },
                    }))
                  }
                  rows={4}
                  placeholder="Was die Story über diese Figur weiß …"
                  className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-zinc-200"
                />
                {draft.archived ? (
                  <input
                    value={draft.reason}
                    onChange={(e) =>
                      setCharDrafts((prev) => ({
                        ...prev,
                        [c.id]: {
                          ...prev[c.id]!,
                          reason: e.target.value,
                        },
                      }))
                    }
                    placeholder="Grund (z. B. tot, weggegangen)"
                    className="mt-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs"
                  />
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveCharacter(c)}
                  className="mt-2 rounded-lg bg-accent/20 px-3 py-1.5 text-xs text-accent disabled:opacity-40"
                >
                  Figur speichern
                </button>
              </li>
            );
          })}
        </ul>

        {cast.length === 0 ? (
          <p className="text-xs text-zinc-500">Noch kein Cast in dieser Story.</p>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <Link
          href={`/story/${storyId}/voices`}
          className="text-center text-xs text-zinc-500 underline"
        >
          Figuren-Stimmen (TTS)
        </Link>
      </div>
    </main>
  );
}
