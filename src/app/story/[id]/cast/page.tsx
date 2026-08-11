"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CastCharacterCard } from "@/components/story-editor/CastCharacterCard";
import { useStorySession } from "@/lib/story/useStorySession";
import {
  getStoryOverview,
  updateCharacterCard,
  updateCharacterManual,
  type CharacterRow,
} from "@/lib/db/stories";
import { loadOpenRouterSettings } from "@/lib/storage/openRouterSettings";
import { suggestCastField, type CastField } from "@/lib/cast/castFieldAi";
import { getStoryConcept } from "@/lib/story/storyOrigin";
import type { StoryCharacterCard } from "@/lib/types";

type Draft = {
  description: string;
  personality: string;
  memory: string;
  archived: boolean;
  reason: string;
};

export default function StoryCastPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyField, setBusyField] = useState<CastField | null>(null);
  const [storyTitle, setStoryTitle] = useState("");
  const [storyConcept, setStoryConcept] = useState<string | null>(null);
  const [storyLocale, setStoryLocale] = useState<"de" | "en">("de");
  const [cast, setCast] = useState<CharacterRow[]>([]);
  const [charDrafts, setCharDrafts] = useState<Record<string, Draft>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const overview = await getStoryOverview(storyId);
    setStoryTitle(overview.story.title as string);
    setStoryLocale(
      (overview.story.locale as string) === "en" ? "en" : "de",
    );
    setStoryConcept(
      getStoryConcept(
        (overview.story.settings ?? {}) as Record<string, unknown>,
        overview.narrator as StoryCharacterCard,
      ),
    );
    const members = overview.cast.filter((c) => c.role === "cast");
    setCast(members);

    const drafts: Record<string, Draft> = {};
    for (const c of members) {
      drafts[c.id] = {
        description: c.card_json.description ?? "",
        personality: c.card_json.personality ?? "",
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

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setCharDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyDraft()), ...patch },
    }));
  };

  const saveCharacter = async (c: CharacterRow) => {
    const draft = charDrafts[c.id];
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      // Card fields
      const card = { ...c.card_json, ...{} } as StoryCharacterCard;
      if (
        draft.description !== (c.card_json.description ?? "") ||
        draft.personality !== (c.card_json.personality ?? "")
      ) {
        const nextCard: StoryCharacterCard = {
          ...card,
          description: draft.description,
          personality: draft.personality,
        };
        await updateCharacterCard(c.id, storyId, nextCard);
      }
      // Manual fields
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

  const aiSuggest = async (c: CharacterRow, field: CastField) => {
    const settings = loadOpenRouterSettings();
    if (!settings || !charDrafts[c.id]) return;
    setBusyField(field);
    setError(null);
    try {
      const draft = charDrafts[c.id];
      const value = await suggestCastField(settings, {
        field,
        characterName: c.name,
        characterRole: c.role ?? "cast",
        currentValue:
          field === "description"
            ? draft.description
            : field === "personality"
              ? draft.personality
              : draft.memory,
        storyTitle,
        storyConcept,
        locale: storyLocale,
      });
      if (field === "description") patchDraft(c.id, { description: value });
      else if (field === "personality") patchDraft(c.id, { personality: value });
      else patchDraft(c.id, { memory: value });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyField(null);
    }
  };

  const sortedCast = useMemo(
    () =>
      [...cast].sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
      ),
    [cast],
  );

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
            Karte antippen zum Bearbeiten — 🎲 KI nutzt das Story-Konzept für
            Beschreibung, Persönlichkeit und Erinnerungen.
          </p>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <ul className="flex flex-col gap-3">
          {sortedCast.map((c) => {
            const draft = charDrafts[c.id];
            if (!draft) return null;
            return (
              <CastCharacterCard
                key={c.id}
                character={c}
                isNarrator={c.role === "narrator"}
                expanded={expandedId === c.id}
                onToggle={() =>
                  setExpandedId(expandedId === c.id ? null : c.id)
                }
                draft={draft}
                onDraftChange={(patch) => patchDraft(c.id, patch)}
                busyField={busyField}
                onAiSuggest={(field) => void aiSuggest(c, field)}
                busySaving={busy}
                onSave={() => void saveCharacter(c)}
              />
            );
          })}
        </ul>

        {cast.length === 0 ? (
          <p className="text-xs text-zinc-500">Noch kein Cast in dieser Story.</p>
        ) : null}

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

function emptyDraft(): Draft {
  return {
    description: "",
    personality: "",
    memory: "",
    archived: false,
    reason: "",
  };
}