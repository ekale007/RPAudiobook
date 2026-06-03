"use client";

import { OverlayPanel } from "@/components/ui/OverlayPanel";
import {
  ProtagonistSetupFields,
  useProtagonistSetupState,
} from "@/components/story-hub/ProtagonistSetupFields";
import type { StoryProtagonistImportSetup } from "@/lib/db/stories";
import { getLibraryTemplate } from "@/lib/story/libraryTemplates";
import type { LibraryTemplateId } from "@/lib/story/libraryTemplates";
import { normalizeStoryContentLocale } from "@/lib/story/protagonist";
import { voiceMapForStorage } from "@/lib/tts/defaultVoiceMap";
import { isQwenTtsMode } from "@/lib/tts/qwenTtsMode";
import {
  fallbackVoice,
  initialProtagonistVoiceMap,
  resolveLocalEngine,
} from "@/lib/tts/protagonistVoiceUi";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";
import { PROTAGONIST_SPEAKER_SLUG } from "@/lib/story/protagonist";
import type { StoryProtagonistProfile } from "@/lib/types";

export function LibraryImportProtagonistModal({
  templateId,
  open,
  busy,
  onClose,
  onConfirm,
}: {
  templateId: LibraryTemplateId;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (setup: StoryProtagonistImportSetup) => void;
}) {
  const template = getLibraryTemplate(templateId);
  const storyLocale = normalizeStoryContentLocale(template?.locale);
  const baseMap = template
    ? initialProtagonistVoiceMap(storyLocale)
    : undefined;

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
  } = useProtagonistSetupState(storyLocale, null, baseMap);

  const buildSetup = (): StoryProtagonistImportSetup => {
    const tts = loadTtsSettings();
    const engine = resolveLocalEngine(tts.provider, tts.localEngine);
    const protagonist: StoryProtagonistProfile = {
      displayName: name.trim() || defaults.displayName,
      pronouns,
      gender,
    };
    const qwenMode = isQwenTtsMode(tts.provider, engine);
    const speaker = qwenMode
      ? qwenProfile.presetSpeaker?.trim() ||
        voiceMap[PROTAGONIST_SPEAKER_SLUG] ||
        fallbackVoice(tts.provider, engine)
      : (voiceMap[PROTAGONIST_SPEAKER_SLUG] ?? fallbackVoice(tts.provider, engine)).trim();
    const nextVoiceMap = voiceMapForStorage(tts.provider, storyLocale, {
      ...voiceMap,
      [PROTAGONIST_SPEAKER_SLUG]: speaker,
    });
    const setup: StoryProtagonistImportSetup = {
      protagonist,
      voiceMap: nextVoiceMap,
    };
    if (qwenMode) {
      setup.qwenVoiceProfiles = {
        [PROTAGONIST_SPEAKER_SLUG]: {
          ...qwenProfile,
          slug: PROTAGONIST_SPEAKER_SLUG,
          presetSpeaker: speaker,
          updatedAt: new Date().toISOString(),
        },
      };
    }
    return setup;
  };

  if (!template) return null;

  return (
    <OverlayPanel
      open={open}
      onClose={busy ? () => undefined : onClose}
      blocking
      title={storyLocale === "de" ? "Protagonist für Import" : "Protagonist for import"}
      wide
    >
      <p className="mb-1 text-sm font-medium text-zinc-200">{template.title}</p>
      <p className="mb-4 text-sm text-zinc-400">
        {storyLocale === "de"
          ? "Name, Anrede und Stimme für deine Dialogzeilen — einmal festlegen, dann startet die Story."
          : "Name, pronouns, and voice for your lines — set once, then the story begins."}
      </p>

      <ProtagonistSetupFields
        storyLocale={storyLocale}
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

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm text-zinc-300 disabled:opacity-50"
        >
          {storyLocale === "de" ? "Abbrechen" : "Cancel"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(buildSetup())}
          className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          {busy
            ? storyLocale === "de"
              ? "Importiere…"
              : "Importing…"
            : storyLocale === "de"
              ? "Story importieren"
              : "Import story"}
        </button>
      </div>
    </OverlayPanel>
  );
}
