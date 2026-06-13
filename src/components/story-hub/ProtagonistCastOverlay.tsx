"use client";

import { useEffect, useState } from "react";
import { ElevenLabsVoiceSelect } from "@/components/ElevenLabsVoiceSelect";
import { FishAudioVoiceSelect } from "@/components/FishAudioVoiceSelect";
import { FalTtsVoiceSelect } from "@/components/FalTtsVoiceSelect";
import { OpenRouterTtsVoiceSelect } from "@/components/OpenRouterTtsVoiceSelect";
import { QwenVoiceEditor } from "@/components/QwenVoiceEditor";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import { updateStorySettings } from "@/lib/db/stories";
import { formatUnknownError } from "@/lib/util/formatUnknownError";
import {
  patchStoryVoiceMaps,
  voiceMapForStorage,
} from "@/lib/tts/defaultVoiceMap";
import { emptyQwenProfile } from "@/lib/tts/qwenVoiceProfiles";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import { loadTtsSettings, saveFishAudioPinnedIds, type TtsProvider } from "@/lib/storage/ttsSettings";
import { normalizeOpenRouterTtsModel } from "@/lib/tts/openRouterTtsModels";
import { normalizeFalTtsModel } from "@/lib/tts/falTtsModels";
import {
  defaultProtagonistProfile,
  PROTAGONIST_SPEAKER_SLUG,
  type StoryContentLocale,
} from "@/lib/story/protagonist";
import type {
  QwenVoiceProfile,
  StoryProtagonistProfile,
  StorySettings,
  VoiceMap,
} from "@/lib/types";

export function ProtagonistCastOverlay({
  open,
  onClose,
  storyId,
  storyLocale,
  storySettings,
  ttsProvider,
  localEngine,
  voiceOptions,
  defaults,
  fallback,
  voiceMap,
  qwenMode,
  qwenProfile,
  onVoiceMapChange,
  onQwenProfileChange,
  qwenProfiles,
  qwenSceneInstruct,
  voiceEnabledSlugs,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  storyId: string;
  storyLocale: StoryContentLocale;
  storySettings: StorySettings;
  ttsProvider: TtsProvider;
  localEngine: LocalTtsEngine;
  voiceOptions: Array<{ id: string; label: string }>;
  defaults: VoiceMap;
  fallback: string;
  voiceMap: VoiceMap;
  qwenMode: boolean;
  qwenProfile?: QwenVoiceProfile;
  onVoiceMapChange: (map: VoiceMap) => void;
  onQwenProfileChange?: (slug: string, profile: QwenVoiceProfile) => void;
  qwenProfiles: Record<string, QwenVoiceProfile>;
  qwenSceneInstruct: boolean;
  voiceEnabledSlugs: string[];
  onSaved?: () => void;
}) {
  const defaultsProfile = defaultProtagonistProfile(storyLocale);
  const existing = storySettings.protagonist;

  const [name, setName] = useState(
    existing?.displayName?.trim() || defaultsProfile.displayName,
  );
  const [pronouns, setPronouns] = useState<StoryProtagonistProfile["pronouns"]>(
    existing?.pronouns ?? defaultsProfile.pronouns,
  );
  const [gender, setGender] = useState<StoryProtagonistProfile["gender"]>(
    existing?.gender ?? defaultsProfile.gender ?? "neutral",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const profile =
    qwenProfile ?? emptyQwenProfile(PROTAGONIST_SPEAKER_SLUG);
  const currentVoice =
    (qwenMode ? profile.presetSpeaker : null) ??
    voiceMap[PROTAGONIST_SPEAKER_SLUG] ??
    defaults[PROTAGONIST_SPEAKER_SLUG] ??
    voiceMap.narrator ??
    fallback;

  useEffect(() => {
    if (!open) return;
    const p = storySettings.protagonist;
    setName(p?.displayName?.trim() || defaultsProfile.displayName);
    setPronouns(p?.pronouns ?? defaultsProfile.pronouns);
    setGender(p?.gender ?? defaultsProfile.gender ?? "neutral");
    setError(null);
    setMessage(null);
  }, [open, storySettings.protagonist, defaultsProfile]);

  const pronounOptions: Array<{
    id: StoryProtagonistProfile["pronouns"];
    label: string;
  }> =
    storyLocale === "de"
      ? [
          { id: "du", label: "Du (neutral)" },
          { id: "sie", label: "Sie (weiblich)" },
          { id: "er", label: "Er (männlich)" },
        ]
      : [
          { id: "you", label: "You" },
          { id: "they", label: "They" },
        ];

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const protagonist: StoryProtagonistProfile = {
        displayName: name.trim() || defaultsProfile.displayName,
        pronouns,
        gender,
      };
      const speaker = qwenMode
        ? profile.presetSpeaker?.trim() || currentVoice
        : (voiceMap[PROTAGONIST_SPEAKER_SLUG] ?? currentVoice).trim() ||
          currentVoice;
      const vmOpts = {
        localEngine,
        falTtsModel: loadTtsSettings().falTtsModel,
      };
      const mapWithSpeaker = {
        ...voiceMap,
        [PROTAGONIST_SPEAKER_SLUG]: speaker,
      };
      const nextVoiceMap = voiceMapForStorage(
        ttsProvider,
        storyLocale,
        mapWithSpeaker,
        vmOpts,
      );
      onVoiceMapChange(nextVoiceMap);

      const patch: Parameters<typeof updateStorySettings>[1] = {
        protagonist,
        ...patchStoryVoiceMaps(
          storySettings,
          ttsProvider,
          storyLocale,
          mapWithSpeaker,
          vmOpts,
        ),
        voiceEnabledSlugs,
      };
      if (qwenMode && onQwenProfileChange) {
        const nextProfile: QwenVoiceProfile = {
          ...profile,
          slug: PROTAGONIST_SPEAKER_SLUG,
          presetSpeaker: speaker,
          updatedAt: new Date().toISOString(),
        };
        onQwenProfileChange(PROTAGONIST_SPEAKER_SLUG, nextProfile);
        patch.qwenVoiceProfiles = {
          ...qwenProfiles,
          [PROTAGONIST_SPEAKER_SLUG]: nextProfile,
        };
        patch.qwenSceneInstructEnabled = qwenSceneInstruct;
      }
      await updateStorySettings(storyId, patch);
      setMessage(
        storyLocale === "de"
          ? "Protagonist gespeichert."
          : "Protagonist saved.",
      );
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
      title={storyLocale === "de" ? "Protagonist (du)" : "Protagonist (you)"}
      wide
    >
      <p className="mb-3 text-[11px] leading-snug text-zinc-500">
        {storyLocale === "de"
          ? "Eigene Stimme für deine Dialogzeilen — getrennt vom Erzähler und vom NPC-Cast."
          : "Dedicated voice for your dialogue — separate from narrator and NPC cast."}
      </p>

      <label className="mb-3 block text-xs text-zinc-400">
        {storyLocale === "de" ? "Name im Spiel" : "In-story name"}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
        />
      </label>

      <fieldset className="mb-3">
        <legend className="mb-1 text-xs text-zinc-400">
          {storyLocale === "de" ? "Anrede / Pronomen" : "Pronouns"}
        </legend>
        <div className="flex flex-col gap-1.5">
          {pronounOptions.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="protagonist-pronouns"
                checked={pronouns === o.id}
                onChange={() => setPronouns(o.id)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mb-4 block text-xs text-zinc-400">
        {storyLocale === "de"
          ? "Geschlecht (für Beschreibungen)"
          : "Gender (for descriptions)"}
        <select
          value={gender ?? "neutral"}
          onChange={(e) =>
            setGender(e.target.value as StoryProtagonistProfile["gender"])
          }
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
        >
          <option value="neutral">
            {storyLocale === "de" ? "Neutral / offen" : "Neutral"}
          </option>
          <option value="female">
            {storyLocale === "de" ? "Weiblich" : "Female"}
          </option>
          <option value="male">
            {storyLocale === "de" ? "Männlich" : "Male"}
          </option>
        </select>
      </label>

      <section className="mb-4 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {storyLocale === "de" ? "Stimme" : "Voice"}
        </p>
        {qwenMode ? (
          <QwenVoiceEditor
            profile={profile}
            onChange={(next) =>
              onQwenProfileChange?.(PROTAGONIST_SPEAKER_SLUG, next)
            }
            locale={storyLocale}
            compact
          />
        ) : ttsProvider === "elevenlabs" ? (
          <ElevenLabsVoiceSelect
            value={currentVoice}
            onChange={(id) =>
              onVoiceMapChange({
                ...voiceMap,
                [PROTAGONIST_SPEAKER_SLUG]: id,
              })
            }
            storyLocale={storyLocale}
            allowCustom
          />
        ) : ttsProvider === "openrouter-tts" ? (
          <OpenRouterTtsVoiceSelect
            model={normalizeOpenRouterTtsModel(
              loadTtsSettings().openRouterTtsModel,
            )}
            value={currentVoice}
            onChange={(id) =>
              onVoiceMapChange({
                ...voiceMap,
                [PROTAGONIST_SPEAKER_SLUG]: id,
              })
            }
            allowCustom
          />
        ) : ttsProvider === "fish-audio" ? (
          <FishAudioVoiceSelect
            value={currentVoice}
            onChange={(id) =>
              onVoiceMapChange({
                ...voiceMap,
                [PROTAGONIST_SPEAKER_SLUG]: id,
              })
            }
            fishModel={loadTtsSettings().fishAudioModel || "s2-pro"}
            pinnedIds={loadTtsSettings().fishAudioPinnedIds ?? []}
            onPinnedIdsChange={saveFishAudioPinnedIds}
            allowCustom
          />
        ) : ttsProvider === "fal-ai" ? (
          <FalTtsVoiceSelect
            model={normalizeFalTtsModel(loadTtsSettings().falTtsModel)}
            value={currentVoice}
            onChange={(id) =>
              onVoiceMapChange({
                ...voiceMap,
                [PROTAGONIST_SPEAKER_SLUG]: id,
              })
            }
            allowCustom
          />
        ) : (
          <select
            value={currentVoice}
            onChange={(e) =>
              onVoiceMapChange({
                ...voiceMap,
                [PROTAGONIST_SPEAKER_SLUG]: e.target.value,
              })
            }
            className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
          >
            {voiceOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-zinc-600">
          Slug: <code className="text-zinc-500">{PROTAGONIST_SPEAKER_SLUG}</code>
        </p>
      </section>

      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
      {message ? <p className="mb-2 text-sm text-emerald-400">{message}</p> : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {busy
          ? storyLocale === "de"
            ? "Speichern…"
            : "Saving…"
          : storyLocale === "de"
            ? "Speichern"
            : "Save"}
      </button>
    </OverlayPanel>
  );
}
