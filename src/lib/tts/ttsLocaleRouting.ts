import { LOCAL_TTS_PRESETS } from "@/lib/storage/ttsPresets";
import type { TtsSettings } from "@/lib/storage/ttsSettings";
import { isKokoroEngine } from "@/lib/tts/kokoroPronunciation";

export type TtsStoryLocale = "de" | "en" | string;

export function normalizeStoryLocale(locale?: string | null): "de" | "en" {
  return locale?.toLowerCase().startsWith("de") ? "de" : "en";
}

/** Kokoro-82M is English-only — route German stories through edge-tts. */
export function resolveLocalTtsRoute(
  settings: TtsSettings,
  storyLocale: TtsStoryLocale | undefined,
  voice: string,
): {
  serverUrl: string;
  voice: string;
  engine: "kokoro" | "edge" | "qwen" | "other";
} {
  const locale = normalizeStoryLocale(storyLocale);
  const base = settings.localServerUrl.replace(/\/$/, "");

  if (settings.localEngine === "qwen") {
    return { serverUrl: base, voice, engine: "qwen" };
  }

  if (isKokoroEngine(settings) && locale === "de") {
    const edgeUrl = LOCAL_TTS_PRESETS.edge.serverUrl.replace(/\/$/, "");
    return {
      serverUrl: edgeUrl,
      voice: kokoroVoiceToGermanEdge(voice),
      engine: "edge",
    };
  }

  if (isKokoroEngine(settings)) {
    return { serverUrl: base, voice, engine: "kokoro" };
  }

  if (settings.localEngine === "edge") {
    const edgeVoice =
      locale === "de" && isEnglishEdgeVoice(voice)
        ? defaultGermanEdgeVoice(voice)
        : voice;
    return { serverUrl: base, voice: edgeVoice, engine: "edge" };
  }

  return { serverUrl: base, voice, engine: "other" };
}

function isEnglishEdgeVoice(voice: string): boolean {
  return /^en-/i.test(voice.trim());
}

function isFemaleKokoroVoice(voice: string): boolean {
  return /^(af|bf)_/i.test(voice.trim());
}

function kokoroVoiceToGermanEdge(voice: string): string {
  if (isEnglishEdgeVoice(voice)) return defaultGermanEdgeVoice(voice);
  return isFemaleKokoroVoice(voice)
    ? "de-DE-KatjaNeural"
    : "de-DE-ConradNeural";
}

function defaultGermanEdgeVoice(referenceVoice: string): string {
  const v = referenceVoice.toLowerCase();
  if (
    v.includes("female") ||
    v.includes("jenny") ||
    v.includes("aria") ||
    v.includes("sara")
  ) {
    return "de-DE-KatjaNeural";
  }
  return "de-DE-ConradNeural";
}

export function localTtsRouteCacheSuffix(
  settings: TtsSettings,
  storyLocale: TtsStoryLocale | undefined,
): string {
  const route = resolveLocalTtsRoute(
    settings,
    storyLocale,
    settings.localVoice,
  );
  if (route.engine === "edge" && isKokoroEngine(settings)) {
    return `:de-edge:${route.voice}`;
  }
  return normalizeStoryLocale(storyLocale) === "de" ? ":de" : "";
}
