import {
  DEFAULT_QWEN_VOICE_MAP,
  DEFAULT_WRYTOUR_VOICE_MAP,
  mergeVoiceMapForProvider,
} from "@/lib/tts/defaultVoiceMap";
import { ELEVEN_DEFAULT_NARRATOR } from "@/lib/tts/elevenLabsVoices";
import { KOKORO_VOICES } from "@/lib/tts/kokoroVoices";
import { QWEN_DEFAULT_NARRATOR, QWEN_VOICES } from "@/lib/tts/qwenVoices";
import type { LocalTtsEngine } from "@/lib/storage/ttsPresets";
import { loadTtsSettings, type TtsProvider } from "@/lib/storage/ttsSettings";
import { DEFAULT_FISH_AUDIO_REFERENCE_ID } from "@/lib/tts/fishAudioVoices";
import { openRouterTtsModelMeta, DEFAULT_OPENROUTER_TTS_MODEL } from "@/lib/tts/openRouterTtsModels";
import { PROTAGONIST_SPEAKER_SLUG, type StoryContentLocale } from "@/lib/story/protagonist";
import type { VoiceMap } from "@/lib/types";

export function voiceOptionsForEngine(engine: LocalTtsEngine) {
  if (engine === "qwen") {
    return QWEN_VOICES.map((v) => ({
      id: v.id,
      label: `${v.label} (${v.hint})`,
    }));
  }
  return KOKORO_VOICES.map((v) => ({
    id: v.id,
    label: `${v.label} (${v.id})`,
  }));
}

export function defaultMapForEngine(engine: LocalTtsEngine): VoiceMap {
  return engine === "qwen" ? DEFAULT_QWEN_VOICE_MAP : DEFAULT_WRYTOUR_VOICE_MAP;
}

export function fallbackVoice(provider: TtsProvider, engine: LocalTtsEngine): string {
  if (provider === "elevenlabs") return ELEVEN_DEFAULT_NARRATOR;
  if (provider === "qwen" || provider === "qwen-cloud") {
    return QWEN_DEFAULT_NARRATOR;
  }
  if (provider === "openrouter-tts") {
    return openRouterTtsModelMeta(DEFAULT_OPENROUTER_TTS_MODEL).defaultVoice;
  }
  if (provider === "fish-audio") {
    return DEFAULT_FISH_AUDIO_REFERENCE_ID;
  }
  return engine === "qwen" ? QWEN_DEFAULT_NARRATOR : "af_bella";
}

export function resolveLocalEngine(
  provider: TtsProvider,
  localEngine?: LocalTtsEngine,
): LocalTtsEngine {
  if (provider === "qwen" || provider === "qwen-cloud") return "qwen";
  if (localEngine === "qwen" || localEngine === "kokoro") return localEngine;
  return "kokoro";
}

/** Initial voice map for protagonist setup (protagonist defaults to narrator voice). */
export function initialProtagonistVoiceMap(
  storyLocale: StoryContentLocale,
  baseVoiceMap?: VoiceMap | null,
): VoiceMap {
  const tts = loadTtsSettings();
  const merged = mergeVoiceMapForProvider(
    tts.provider,
    storyLocale,
    baseVoiceMap ?? undefined,
  );
  const narrator = merged.narrator?.trim() || fallbackVoice(tts.provider, resolveLocalEngine(tts.provider, tts.localEngine));
  const protagonist =
    merged[PROTAGONIST_SPEAKER_SLUG]?.trim() || narrator;
  return { ...merged, [PROTAGONIST_SPEAKER_SLUG]: protagonist };
}
