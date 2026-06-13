"use client";

import { useState } from "react";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import {
  ProtagonistSetupFields,
  useProtagonistSetupState,
} from "@/components/story-hub/ProtagonistSetupFields";
import { updateStorySettings } from "@/lib/db/stories";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";
import {
  patchStoryVoiceMaps,
  resolveStoryVoiceMap,
} from "@/lib/tts/defaultVoiceMap";
import { isQwenTtsMode } from "@/lib/tts/qwenTtsMode";
import {
  fallbackVoice,
  resolveLocalEngine,
} from "@/lib/tts/protagonistVoiceUi";
import {
  normalizeStoryContentLocale,
  PROTAGONIST_SPEAKER_SLUG,
} from "@/lib/story/protagonist";
import type { StoryProtagonistProfile, StorySettings } from "@/lib/types";

export function ProtagonistSetupModal({
  open,
  storyId,
  storyLocale,
  storySettings,
  onComplete,
}: {
  open: boolean;
  storyId: string;
  storyLocale: string | null | undefined;
  storySettings: StorySettings;
  onComplete: (settings: StorySettings) => void;
}) {
  const locale = normalizeStoryContentLocale(storyLocale);
  const {
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
  } = useProtagonistSetupState(
    locale,
    storySettings.protagonist,
    resolveStoryVoiceMap(storySettings, loadTtsSettings().provider, locale, {
      localEngine: resolveLocalEngine(
        loadTtsSettings().provider,
        loadTtsSettings().localEngine,
      ),
      falTtsModel: loadTtsSettings().falTtsModel,
    }),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const protagonist: StoryProtagonistProfile = {
        displayName: name.trim() || defaults.displayName,
        pronouns,
        gender,
      };
      const tts = loadTtsSettings();
      const engine = resolveLocalEngine(tts.provider, tts.localEngine);
      const qwenMode = isQwenTtsMode(tts.provider, engine);
      const speaker = qwenMode
        ? qwenProfile.presetSpeaker?.trim() ||
          voiceMap[PROTAGONIST_SPEAKER_SLUG] ||
          fallbackVoice(tts.provider, engine)
        : (voiceMap[PROTAGONIST_SPEAKER_SLUG] ?? fallbackVoice(tts.provider, engine)).trim();
      const vmOpts = {
        localEngine: engine,
        falTtsModel: tts.falTtsModel,
      };
      const mapWithSpeaker = {
        ...voiceMap,
        [PROTAGONIST_SPEAKER_SLUG]: speaker,
      };
      const patch: Parameters<typeof updateStorySettings>[1] = {
        protagonist,
        ...patchStoryVoiceMaps(
          storySettings,
          tts.provider,
          locale,
          mapWithSpeaker,
          vmOpts,
        ),
      };
      if (qwenMode) {
        patch.qwenVoiceProfiles = {
          ...(storySettings.qwenVoiceProfiles ?? {}),
          [PROTAGONIST_SPEAKER_SLUG]: {
            ...qwenProfile,
            slug: PROTAGONIST_SPEAKER_SLUG,
            presetSpeaker: speaker,
            updatedAt: new Date().toISOString(),
          },
        };
      }
      const merged = await updateStorySettings(storyId, patch);
      onComplete(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayPanel
      open={open}
      onClose={() => undefined}
      blocking
      title={locale === "de" ? "Dein Charakter" : "Your character"}
      wide
    >
      <p className="mb-4 text-sm text-zinc-400">
        {locale === "de"
          ? "Name, Anrede und Stimme für deine Dialogzeilen — einmal festlegen, dann geht es los."
          : "Name, pronouns, and voice for your lines — set once, then you are ready."}
      </p>

      <ProtagonistSetupFields
        storyLocale={locale}
        name={name}
        onNameChange={setName}
        pronouns={pronouns}
        onPronounsChange={setPronouns}
        gender={gender}
        onGenderChange={setGender}
        voiceMap={voiceMap}
        onVoiceMapChange={setVoiceMap}
        qwenProfile={qwenProfile}
        onQwenProfileChange={setQwenProfile}
      />

      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {busy
          ? locale === "de"
            ? "Speichern…"
            : "Saving…"
          : locale === "de"
            ? "Story starten"
            : "Start story"}
      </button>
    </OverlayPanel>
  );
}
