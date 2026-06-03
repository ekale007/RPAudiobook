import { downloadBlob, audioFilenameForTurn } from "@/lib/audio/downloadBlob";
import { downloadTurnAudio } from "@/lib/db/ttsStorage";
import { getCachedAudio } from "@/lib/storage/ttsAudioCache";
import { getNarratorAudio } from "@/lib/tts/narratorTts";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";
import type { CharacterRow } from "@/lib/db/stories";
import type { StorySettings, VoiceMap } from "@/lib/types";
import type { VoiceEnabledSlugs } from "@/lib/tts/voiceActivation";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import { ttsCacheVoiceKey } from "@/lib/storage/ttsSettings";
import { buildTtsCacheKey } from "@/lib/storage/ttsAudioCache";
import { voiceForSpeaker } from "@/lib/tts/defaultVoiceMap";
import { localTtsRouteCacheSuffix } from "@/lib/tts/ttsLocaleRouting";

export type SaveTurnAudioInput = {
  turnId: string;
  text: string;
  rawContent?: string;
  audioStoragePath?: string | null;
  speakerSlug?: string | null;
  voiceMap?: VoiceMap;
  voiceEnabledSlugs?: VoiceEnabledSlugs;
  cast?: CharacterRow[];
  storyLocale?: string;
  storySettings?: StorySettings;
  chapterTitle?: string | null;
};

/** Resolve MP3 blob for a turn (cache → cloud → regenerate). */
export async function resolveTurnAudioBlob(
  input: SaveTurnAudioInput,
): Promise<Blob | null> {
  const settings = loadTtsSettings();
  const baseText =
    stripSpeakerTags(input.rawContent ?? input.text).trim() ||
    input.text.trim();
  if (!baseText) return null;

  const localVoice =
    (settings.provider === "local" ||
      settings.provider === "qwen" ||
      settings.provider === "qwen-cloud") &&
    input.voiceMap
      ? voiceForSpeaker(
          input.speakerSlug,
          input.voiceMap,
          settings.localVoice,
          input.voiceEnabledSlugs,
        )
      : settings.localVoice;

  const cacheKey = buildTtsCacheKey(
    settings.provider === "local" ||
      settings.provider === "qwen" ||
      settings.provider === "qwen-cloud"
      ? `${ttsCacheVoiceKey(settings)}:${localVoice}${localTtsRouteCacheSuffix(settings, input.storyLocale)}`
      : ttsCacheVoiceKey(settings),
    settings.provider,
    baseText,
  );

  const cached = await getCachedAudio(cacheKey);
  if (cached) return cached;

  if (input.audioStoragePath) {
    const fromCloud = await downloadTurnAudio(input.audioStoragePath);
    if (fromCloud) return fromCloud;
  }

  try {
    const audio = await getNarratorAudio(settings, baseText, {
      speakerSlug: input.speakerSlug,
      voiceMap: input.voiceMap,
      cast: input.cast,
      voiceEnabledSlugs: input.voiceEnabledSlugs,
      rawContent: input.rawContent ?? input.text,
      storyLocale: input.storyLocale,
      storySettings: input.storySettings,
    });
    return audio.blob;
  } catch {
    return null;
  }
}

export async function saveTurnAudioToDevice(
  input: SaveTurnAudioInput,
): Promise<{ ok: boolean; error?: string }> {
  const blob = await resolveTurnAudioBlob(input);
  if (!blob) {
    return {
      ok: false,
      error: "Keine Audio-Datei — zuerst ▶ zum Erzeugen tippen.",
    };
  }
  downloadBlob(blob, audioFilenameForTurn(input.turnId, input.chapterTitle));
  return { ok: true };
}
