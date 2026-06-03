import type { CharacterRow } from "@/lib/db/stories";
import { loadPlaybackRate } from "@/lib/storage/ttsPlaybackSettings";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";
import { isAutoplayBlockedError } from "@/lib/tts/autoplayPolicy";
import { unlockAudioForAutoplay } from "@/lib/tts/audioUnlock";
import {
  playBlobViaWebAudio,
  preferHtmlMediaPlayback,
} from "@/lib/tts/mobileAudioPlayback";
import {
  clearTtsNowPlaying,
  setTtsMediaPlaybackState,
  setTtsNowPlaying,
  syncTtsMediaPosition,
} from "@/lib/tts/ttsMediaSession";
import { getNarratorAudio } from "@/lib/tts/narratorTts";
import type { VoiceEnabledSlugs } from "@/lib/tts/voiceActivation";
import type { StorySettings, VoiceMap } from "@/lib/types";

export type PlayAssistantTurnParams = {
  turnId: string;
  text: string;
  rawContent?: string;
  speakerSlug?: string | null;
  voiceMap?: VoiceMap;
  segmentOverrides?: Record<string, string>;
  cast?: CharacterRow[];
  voiceEnabledSlugs?: VoiceEnabledSlugs;
  storyLocale?: string;
  storySettings?: StorySettings;
};

export type PlayTurnAudioResult = "ok" | "blocked" | "error";

async function playBlobUntilEnd(
  blob: Blob,
  playbackRate: number,
): Promise<PlayTurnAudioResult> {
  if (!preferHtmlMediaPlayback()) {
    try {
      await playBlobViaWebAudio(blob, playbackRate);
      return "ok";
    } catch (error) {
      if (isAutoplayBlockedError(error)) return "blocked";
      return "error";
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.preload = "auto";

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
    };

    setTtsNowPlaying({ title: "Erzähler" });
    setTtsMediaPlaybackState("playing");

    audio.ontimeupdate = () => {
      if (
        !audio.paused &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        syncTtsMediaPosition(
          audio.currentTime,
          audio.duration,
          audio.playbackRate,
        );
      }
    };

    audio.onended = () => {
      cleanup();
      clearTtsNowPlaying();
      resolve("ok");
    };
    audio.onerror = () => {
      cleanup();
      resolve("error");
    };

    void audio.play().catch((error) => {
      cleanup();
      if (isAutoplayBlockedError(error)) resolve("blocked");
      else resolve("error");
    });
  });
}

/** Synthesize (or cache) and play without mounting MessageAudioPlayer. */
export async function playAssistantTurnAudio(
  params: PlayAssistantTurnParams,
): Promise<PlayTurnAudioResult> {
  unlockAudioForAutoplay();
  const settings = loadTtsSettings();
  const baseText = params.text.trim();
  if (!baseText) return "error";

  try {
    const { blob } = await getNarratorAudio(settings, baseText, {
      speakerSlug: params.speakerSlug,
      voiceMap: params.voiceMap,
      segmentOverrides: params.segmentOverrides,
      cast: params.cast,
      voiceEnabledSlugs: params.voiceEnabledSlugs,
      rawContent: params.rawContent ?? params.text,
      storyLocale: params.storyLocale,
      storySettings: params.storySettings,
    });
    return playBlobUntilEnd(blob, loadPlaybackRate());
  } catch {
    return "error";
  }
}

/** Warm IndexedDB / memory cache for the next drive/autoplay clip. */
export async function prefetchAssistantTurnAudio(
  params: PlayAssistantTurnParams,
): Promise<boolean> {
  const settings = loadTtsSettings();
  const baseText = params.text.trim();
  if (!baseText) return false;
  try {
    await getNarratorAudio(settings, baseText, {
      speakerSlug: params.speakerSlug,
      voiceMap: params.voiceMap,
      segmentOverrides: params.segmentOverrides,
      cast: params.cast,
      voiceEnabledSlugs: params.voiceEnabledSlugs,
      rawContent: params.rawContent ?? params.text,
      storyLocale: params.storyLocale,
      storySettings: params.storySettings,
    });
    return true;
  } catch {
    return false;
  }
}
