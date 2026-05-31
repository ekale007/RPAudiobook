"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CharacterAvatarUpload } from "@/components/CharacterAvatarUpload";
import { ElevenLabsVoiceSelect } from "@/components/ElevenLabsVoiceSelect";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import {
  updateCharacterCard,
  updateCharacterManual,
  updateStorySettings,
  type CharacterRow,
} from "@/lib/db/stories";
import {
  adaptCharacterCardWithAi,
  type AdaptedCharacterCard,
} from "@/lib/cast/castStoryAi";
import { loadStoryScanContext, plotStateSummary } from "@/lib/cast/castStoryContext";
import { formatUnknownError } from "@/lib/util/formatUnknownError";
import {
  isLlmReady,
  loadOpenRouterSettings,
  resolveChatModelSettings,
} from "@/lib/storage/openRouterSettings";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import { loadTtsSettings, type TtsProvider } from "@/lib/storage/ttsSettings";
import type { StorySettings, VoiceMap, WryTourCharacter } from "@/lib/types";

type CharDraft = {
  memory: string;
  archived: boolean;
  reason: string;
  card: WryTourCharacter;
};

export function CastCharacterOverlay({
  open,
  character,
  storyId,
  userId,
  storyLocale,
  storyTitle,
  storyConcept,
  storySettings,
  ttsProvider,
  localEngine,
  voiceOptions,
  defaults,
  fallback,
  voiceMap,
  voiceEnabledSlugs,
  onVoiceMapChange,
  onVoiceEnabledChange,
  onClose,
  onSaved,
}: {
  open: boolean;
  character: CharacterRow | null;
  storyId: string;
  userId: string | null;
  storyLocale: "de" | "en";
  storyTitle: string;
  storyConcept: string | null;
  storySettings: StorySettings;
  ttsProvider: TtsProvider;
  localEngine: LocalTtsEngine;
  voiceOptions: Array<{ id: string; label: string }>;
  defaults: VoiceMap;
  fallback: string;
  voiceMap: VoiceMap;
  voiceEnabledSlugs: string[];
  onVoiceMapChange: (map: VoiceMap) => void;
  onVoiceEnabledChange: (slugs: string[]) => void;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [draft, setDraft] = useState<CharDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!character || !open) {
      setDraft(null);
      setError(null);
      setMessage(null);
      setAiInstruction("");
      return;
    }
    setDraft({
      memory: character.character_memory ?? "",
      archived: character.status === "archived",
      reason: character.archived_reason ?? "",
      card: structuredClone(character.card_json),
    });
  }, [character, open]);

  if (!character || !draft) return null;

  const isNarrator = character.role === "narrator";
  const voiceDisabled = !isNarrator && !voiceEnabledSlugs.includes(character.slug);
  const currentVoice =
    voiceMap[character.slug] ?? defaults[character.slug] ?? fallback;

  const toggleVoiceActive = (active: boolean) => {
    const has = voiceEnabledSlugs.includes(character.slug);
    if (active && !has) {
      onVoiceEnabledChange([...voiceEnabledSlugs, character.slug]);
    } else if (!active && has) {
      onVoiceEnabledChange(
        voiceEnabledSlugs.filter((s) => s !== character.slug),
      );
    }
  };

  const applyAdapted = (adapted: AdaptedCharacterCard) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        memory: adapted.character_memory ?? prev.memory,
        card: {
          ...prev.card,
          name: adapted.name,
          description: adapted.description,
          personality: adapted.personality,
          scenario: adapted.scenario,
          mes_example: adapted.mes_example,
        },
      };
    });
  };

  const runAiAdapt = async () => {
    if (!isLlmReady()) {
      setError("LLM nicht konfiguriert — Settings → OpenRouter.");
      return;
    }
    const settings = loadOpenRouterSettings();
    if (!settings) return;

    setAiBusy(true);
    setError(null);
    setMessage(null);
    try {
      const scan = await loadStoryScanContext(
        storyId,
        storyLocale,
        storySettings.plotState,
      );
      const adapted = await adaptCharacterCardWithAi(
        resolveChatModelSettings(settings),
        character,
        scan.transcript,
        {
          storyTitle,
          storyConcept,
          plotState: plotStateSummary(storySettings.plotState),
          userInstruction: aiInstruction,
          locale: storyLocale,
        },
      );
      applyAdapted(adapted);
      setMessage("KI-Vorschlag eingetragen — prüfen und speichern.");
    } catch (e) {
      setError(formatUnknownError(e));
    } finally {
      setAiBusy(false);
    }
  };

  const saveAll = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateCharacterCard(character.id, storyId, draft.card);
      await updateCharacterManual(character.id, storyId, {
        character_memory: draft.memory,
        name: draft.card.name?.trim() || character.name,
        status: draft.archived ? "archived" : "active",
        archived_reason: draft.archived ? draft.reason || "manual" : null,
      });
      const nextVoiceMap = { ...voiceMap, [character.slug]: currentVoice };
      onVoiceMapChange(nextVoiceMap);
      await updateStorySettings(storyId, {
        voiceMap: nextVoiceMap,
        voiceEnabledSlugs,
      });
      setMessage(`„${draft.card.name || character.name}“ gespeichert.`);
      onSaved?.();
    } catch (e) {
      setError(formatUnknownError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      title={draft.card.name || character.name}
      wide
    >
      <div className="flex flex-col gap-4">
        {userId ? (
          <CharacterAvatarUpload
            userId={userId}
            storyId={storyId}
            characterId={character.id}
            name={draft.card.name || character.name}
            card={draft.card}
            onUpdated={(nextCard) =>
              setDraft((prev) =>
                prev ? { ...prev, card: nextCard } : prev,
              )
            }
            onPersisted={onSaved}
            compact
          />
        ) : null}

        <div>
          <input
            value={draft.card.name ?? ""}
            onChange={(e) =>
              setDraft((prev) =>
                prev
                  ? { ...prev, card: { ...prev.card, name: e.target.value } }
                  : prev,
              )
            }
            className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1 text-sm font-medium text-zinc-100"
            placeholder="Name"
          />
          <p className="mt-1 text-[10px] text-zinc-500">
            {isNarrator ? "Erzähler" : "Cast"} · {character.slug}
          </p>
        </div>

        <section className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Stimme
          </p>
          {!isNarrator ? (
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <input
                type="checkbox"
                checked={voiceEnabledSlugs.includes(character.slug)}
                onChange={(e) => toggleVoiceActive(e.target.checked)}
                className="size-3 rounded border-surface-border"
              />
              Eigene Stimme (sonst Erzähler)
            </label>
          ) : null}
          {voiceDisabled ? (
            <p className="text-[11px] text-zinc-600">→ Erzähler-Stimme</p>
          ) : ttsProvider === "elevenlabs" ? (
            <ElevenLabsVoiceSelect
              value={currentVoice}
              onChange={(id) =>
                onVoiceMapChange({ ...voiceMap, [character.slug]: id })
              }
              disabled={voiceDisabled}
              storyLocale={storyLocale}
              allowCustom
            />
          ) : (
            <select
              value={currentVoice}
              disabled={voiceDisabled}
              onChange={(e) =>
                onVoiceMapChange({
                  ...voiceMap,
                  [character.slug]: e.target.value,
                })
              }
              className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50"
            >
              {voiceOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Profil
          </p>
          <label className="block text-[11px] text-zinc-500">
            Beschreibung
            <textarea
              value={draft.card.description ?? ""}
              onChange={(e) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        card: { ...prev.card, description: e.target.value },
                      }
                    : prev,
                )
              }
              rows={2}
              className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-zinc-200"
            />
          </label>
          <label className="block text-[11px] text-zinc-500">
            Persönlichkeit
            <textarea
              value={draft.card.personality ?? ""}
              onChange={(e) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        card: { ...prev.card, personality: e.target.value },
                      }
                    : prev,
                )
              }
              rows={2}
              className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-zinc-200"
            />
          </label>
        </section>

        <section className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Erinnerungen
          </p>
          <textarea
            value={draft.memory}
            onChange={(e) =>
              setDraft((prev) =>
                prev ? { ...prev, memory: e.target.value } : prev,
              )
            }
            rows={4}
            placeholder="Was die Story über diese Figur weiß …"
            className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-zinc-200"
          />
        </section>

        {!isNarrator ? (
          <section className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <input
                type="checkbox"
                checked={draft.archived}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, archived: e.target.checked } : prev,
                  )
                }
              />
              Figur archivieren
            </label>
            {draft.archived ? (
              <input
                value={draft.reason}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, reason: e.target.value } : prev,
                  )
                }
                placeholder="Grund (z. B. tot, weggegangen)"
                className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs"
              />
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl border border-dashed border-accent/25 bg-accent/5 p-3 space-y-2">
          <p className="text-[10px] font-medium text-accent">
            Mit KI aus Story anpassen
          </p>
          <textarea
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            rows={2}
            placeholder="Optional: z. B. „Mehr Berlin-Noir, misstrauisch, kennt den Protagonisten vom Schwarzmarkt“"
            className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-zinc-200"
          />
          <button
            type="button"
            disabled={aiBusy || !isLlmReady()}
            onClick={runAiAdapt}
            className="w-full rounded-lg border border-accent/40 bg-accent/10 py-2 text-xs font-medium text-accent disabled:opacity-40"
          >
            {aiBusy ? "KI arbeitet …" : "Profil aus Story generieren"}
          </button>
          {!isLlmReady() ? (
            <p className="text-[10px] text-zinc-600">
              OpenRouter in Settings nötig.
            </p>
          ) : null}
        </section>

        <div className="flex flex-col gap-2 pb-2">
          <button
            type="button"
            disabled={busy}
            onClick={saveAll}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {busy ? "Speichert …" : "Speichern"}
          </button>
          <Link
            href={`/story/${storyId}/cards`}
            onClick={onClose}
            className="text-center text-[11px] text-zinc-500 underline"
          >
            Erweiterte Karte &amp; Prompts
          </Link>
        </div>

        {message ? <p className="text-xs text-accent">{message}</p> : null}
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </OverlayPanel>
  );
}
