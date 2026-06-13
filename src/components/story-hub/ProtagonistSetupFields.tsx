"use client";

import { useEffect, useMemo, useState } from "react";
import { ElevenLabsVoiceSelect } from "@/components/ElevenLabsVoiceSelect";
import { FishAudioVoiceSelect } from "@/components/FishAudioVoiceSelect";
import { OpenRouterTtsVoiceSelect } from "@/components/OpenRouterTtsVoiceSelect";
import { QwenVoiceEditor } from "@/components/QwenVoiceEditor";
import { emptyQwenProfile } from "@/lib/tts/qwenVoiceProfiles";
import { isQwenTtsMode } from "@/lib/tts/qwenTtsMode";
import {
  defaultProtagonistProfile,
  PROTAGONIST_SPEAKER_SLUG,
  type StoryContentLocale,
} from "@/lib/story/protagonist";
import { loadTtsSettings, type TtsProvider } from "@/lib/storage/ttsSettings";
import { PREFS_UPDATED_EVENT } from "@/lib/storage/userPreferencesSync";
import { normalizeOpenRouterTtsModel } from "@/lib/tts/openRouterTtsModels";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import {
  defaultMapForEngine,
  fallbackVoice,
  initialProtagonistVoiceMap,
  resolveLocalEngine,
  voiceOptionsForEngine,
} from "@/lib/tts/protagonistVoiceUi";
import type {
  QwenVoiceProfile,
  StoryProtagonistProfile,
  VoiceMap,
} from "@/lib/types";

export function ProtagonistSetupFields({
  storyLocale,
  name,
  onNameChange,
  pronouns,
  onPronounsChange,
  gender,
  onGenderChange,
  voiceMap,
  onVoiceMapChange,
  qwenProfile,
  onQwenProfileChange,
}: {
  storyLocale: StoryContentLocale;
  name: string;
  onNameChange: (v: string) => void;
  pronouns: StoryProtagonistProfile["pronouns"];
  onPronounsChange: (v: StoryProtagonistProfile["pronouns"]) => void;
  gender: StoryProtagonistProfile["gender"];
  onGenderChange: (v: StoryProtagonistProfile["gender"]) => void;
  voiceMap: VoiceMap;
  onVoiceMapChange: (map: VoiceMap) => void;
  qwenProfile: QwenVoiceProfile;
  onQwenProfileChange: (profile: QwenVoiceProfile) => void;
}) {
  const defaults = defaultProtagonistProfile(storyLocale);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(
    () => loadTtsSettings().provider,
  );
  const [localEngine, setLocalEngine] = useState<LocalTtsEngine>(() =>
    resolveLocalEngine(loadTtsSettings().provider, loadTtsSettings().localEngine),
  );

  useEffect(() => {
    const sync = () => {
      const tts = loadTtsSettings();
      setTtsProvider(tts.provider);
      setLocalEngine(resolveLocalEngine(tts.provider, tts.localEngine));
    };
    sync();
    window.addEventListener(PREFS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PREFS_UPDATED_EVENT, sync);
  }, []);

  const engine = resolveLocalEngine(ttsProvider, localEngine);
  const qwenMode = isQwenTtsMode(ttsProvider, engine);
  const voiceDefaults = useMemo(
    () =>
      ttsProvider === "elevenlabs"
        ? initialProtagonistVoiceMap(storyLocale)
        : defaultMapForEngine(engine),
    [ttsProvider, storyLocale, engine],
  );
  const fallback = fallbackVoice(ttsProvider, engine);
  const voiceOptions = voiceOptionsForEngine(engine);
  const currentVoice =
    (qwenMode ? qwenProfile.presetSpeaker : null) ??
    voiceMap[PROTAGONIST_SPEAKER_SLUG] ??
    voiceDefaults[PROTAGONIST_SPEAKER_SLUG] ??
    voiceMap.narrator ??
    fallback;
  const ttsSettings = loadTtsSettings();
  const orTtsModel = normalizeOpenRouterTtsModel(ttsSettings.openRouterTtsModel);
  const fishModel = ttsSettings.fishAudioModel || "s2-pro";

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

  return (
    <>
      <label className="mb-3 block text-xs text-zinc-400">
        {storyLocale === "de" ? "Name im Spiel" : "In-story name"}
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          placeholder={
            storyLocale === "de" ? defaults.displayName : defaults.displayName
          }
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
                onChange={() => onPronounsChange(o.id)}
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
            onGenderChange(e.target.value as StoryProtagonistProfile["gender"])
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

      <section className="mb-2 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {storyLocale === "de" ? "Deine Stimme (Dialog)" : "Your voice (dialogue)"}
        </p>
        {qwenMode ? (
          <QwenVoiceEditor
            profile={qwenProfile}
            onChange={onQwenProfileChange}
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
            model={orTtsModel}
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
            fishModel={fishModel}
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
            className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm"
          >
            {voiceOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-zinc-600">
          {storyLocale === "de"
            ? "Getrennt vom Erzähler — gilt für deine gesprochenen Zeilen."
            : "Separate from the narrator — used for your spoken lines."}
        </p>
      </section>
    </>
  );
}

export function useProtagonistSetupState(
  storyLocale: StoryContentLocale,
  existing?: StoryProtagonistProfile | null,
  baseVoiceMap?: VoiceMap | null,
) {
  const defaults = defaultProtagonistProfile(storyLocale);
  const [name, setName] = useState(
    existing?.displayName?.trim() || defaults.displayName,
  );
  const [pronouns, setPronouns] = useState<StoryProtagonistProfile["pronouns"]>(
    existing?.pronouns ?? defaults.pronouns,
  );
  const [gender, setGender] = useState<StoryProtagonistProfile["gender"]>(
    existing?.gender ?? defaults.gender ?? "neutral",
  );
  const [voiceMap, setVoiceMap] = useState<VoiceMap>(() =>
    initialProtagonistVoiceMap(storyLocale, baseVoiceMap),
  );
  const [qwenProfile, setQwenProfile] = useState<QwenVoiceProfile>(() =>
    emptyQwenProfile(PROTAGONIST_SPEAKER_SLUG),
  );

  return {
    name,
    setName,
    pronouns,
    setPronouns,
    gender,
    setGender,
    voiceMap,
    setVoiceMap,
    qwenProfile,
    setQwenProfile,
    defaults,
  };
}
