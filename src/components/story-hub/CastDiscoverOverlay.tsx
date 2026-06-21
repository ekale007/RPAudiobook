"use client";

import { useState } from "react";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import {
  adaptCharacterCardWithAi,
  discoverCharactersFromStory,
  type StoryCharacterCandidate,
} from "@/lib/cast/castStoryAi";
import { loadStoryScanContext, plotStateSummary } from "@/lib/cast/castStoryContext";
import { resolveStoryActorId } from "@/lib/story/useStorySession";
import {
  createCastCharacter,
  updateCharacterCard,
  updateCharacterManual,
  type CharacterRow,
} from "@/lib/db/stories";
import { formatUnknownError } from "@/lib/util/formatUnknownError";
import {
  isLlmReady,
  loadOpenRouterSettings,
  resolveChatModelSettings,
} from "@/lib/storage/openRouterSettings";
import type { StorySettings } from "@/lib/types";

export function CastDiscoverOverlay({
  open,
  onClose,
  storyId,
  cast,
  storyTitle,
  storyConcept,
  storyLocale,
  storySettings,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  storyId: string;
  cast: CharacterRow[];
  storyTitle: string;
  storyConcept: string | null;
  storyLocale: "de" | "en";
  storySettings: StorySettings;
  onImported?: (characterId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [importBusyId, setImportBusyId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<StoryCharacterCandidate[]>([]);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reset = () => {
    setCandidates([]);
    setScanned(false);
    setError(null);
    setMessage(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const scanStory = async () => {
    if (!isLlmReady()) {
      setError("LLM nicht konfiguriert — Settings → OpenRouter.");
      return;
    }
    const settings = loadOpenRouterSettings();
    if (!settings) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const scan = await loadStoryScanContext(
        storyId,
        storyLocale,
        storySettings.plotState,
      );
      if (
        !scan.transcript.trim() &&
        !scan.speakerHints.length &&
        !scan.plotCharacters.length
      ) {
        setError("Noch kein Story-Text — erst im Chat spielen.");
        setCandidates([]);
        setScanned(true);
        return;
      }
      const found = await discoverCharactersFromStory(
        resolveChatModelSettings(settings),
        scan,
        cast,
        {
          storyTitle,
          storyConcept,
          plotState: plotStateSummary(storySettings.plotState),
          locale: storyLocale,
        },
      );
      setCandidates(found);
      setScanned(true);
      if (!found.length) {
        setMessage("Keine neuen Figuren gefunden — Cast ist aktuell.");
      }
    } catch (e) {
      setError(formatUnknownError(e));
    } finally {
      setBusy(false);
    }
  };

  const importCandidate = async (c: StoryCharacterCandidate) => {
    if (!isLlmReady()) {
      setError("LLM nicht konfiguriert.");
      return;
    }
    const settings = loadOpenRouterSettings();
    if (!settings) return;

    setImportBusyId(c.slug);
    setError(null);
    setMessage(null);
    try {
      const userId = await resolveStoryActorId();
      if (!userId) throw new Error("Nicht angemeldet.");

      const scan = await loadStoryScanContext(
        storyId,
        storyLocale,
        storySettings.plotState,
      );
      const { transcript } = scan;
      let characterId = c.existingId;

      if (c.kind === "new") {
        const row = await createCastCharacter(storyId, userId, {
          slug: c.slug,
          name: c.name,
          character_memory: c.suggestedMemory,
        });
        characterId = row.id;
      } else if (characterId) {
        await updateCharacterManual(characterId, storyId, {
          character_memory: c.suggestedMemory,
        });
      }

      if (!characterId) throw new Error("Figur konnte nicht angelegt werden.");

      const roster = cast.find((x) => x.id === characterId);
      const stub =
        roster ??
        ({
          id: characterId,
          slug: c.slug,
          name: c.name,
          role: "cast",
          card_json: { name: c.name, description: c.summary, personality: "" },
          character_memory: c.suggestedMemory,
          status: "active",
        } as CharacterRow);

      const adapted = await adaptCharacterCardWithAi(
        resolveChatModelSettings(settings),
        stub,
        transcript,
        {
          storyTitle,
          storyConcept,
          plotState: plotStateSummary(storySettings.plotState),
          locale: storyLocale,
        },
      );

      await updateCharacterCard(characterId, storyId, {
        ...stub.card_json,
        name: adapted.name,
        description: adapted.description,
        personality: adapted.personality,
        scenario: adapted.scenario,
        mes_example: adapted.mes_example,
      });
      if (adapted.character_memory) {
        await updateCharacterManual(characterId, storyId, {
          character_memory: adapted.character_memory,
        });
      }

      setCandidates((prev) => prev.filter((x) => x.slug !== c.slug));
      setMessage(`„${adapted.name}“ hinzugefügt und angepasst.`);
      onImported?.(characterId);
    } catch (e) {
      setError(formatUnknownError(e));
    } finally {
      setImportBusyId(null);
    }
  };

  return (
    <OverlayPanel open={open} onClose={handleClose} title="Aus Story holen" wide>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Scannt Kapitel-Text nach Figuren, die noch fehlen oder nur minimal
          angelegt sind — dann KI-Profil aus dem bisherigen Verlauf.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={scanStory}
          className="rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-medium text-accent disabled:opacity-50"
        >
          {busy ? "Scannt Story …" : "Story scannen"}
        </button>

        {scanned && !candidates.length && !busy ? (
          <p className="text-[11px] text-zinc-600">
            {message ?? "Keine Kandidaten."}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li
              key={c.slug}
              className="rounded-xl border border-surface-border bg-surface-raised p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-100">{c.name}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {c.kind === "new" ? "Neu in Story" : "Profil auffüllen"}
                    {c.source === "heuristic" ? " · Auto-erkannt" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={importBusyId === c.slug}
                  onClick={() => importCandidate(c)}
                  className="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-black disabled:opacity-40"
                >
                  {importBusyId === c.slug ? "…" : "Übernehmen"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                {c.summary}
              </p>
            </li>
          ))}
        </ul>

        {message && candidates.length ? (
          <p className="text-xs text-accent">{message}</p>
        ) : null}
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </OverlayPanel>
  );
}
