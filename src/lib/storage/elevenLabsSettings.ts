/**
 * @deprecated Use ttsSettings.ts — kept so old imports don't break.
 */
import {
  loadTtsSettings,
  saveTtsSettings,
  type TtsSettings,
} from "@/lib/storage/ttsSettings";

export type ElevenLabsSettings = {
  apiKey: string;
  voiceId: string;
  modelId: string;
};

export const DEFAULT_ELEVENLABS = {
  voiceId: "JBFqnCBsd6RMkjVDRZzb",
  modelId: "eleven_multilingual_v2",
};

export function loadElevenLabsSettings(): ElevenLabsSettings | null {
  const t = loadTtsSettings();
  if (!t.elevenLabsApiKey.trim()) return null;
  return {
    apiKey: t.elevenLabsApiKey,
    voiceId: t.elevenLabsVoiceId,
    modelId: t.elevenLabsModelId,
  };
}

export function saveElevenLabsSettings(settings: ElevenLabsSettings): void {
  const current = loadTtsSettings();
  saveTtsSettings({
    ...current,
    provider: "elevenlabs",
    elevenLabsApiKey: settings.apiKey,
    elevenLabsVoiceId: settings.voiceId,
    elevenLabsModelId: settings.modelId,
  } satisfies TtsSettings);
}

export function clearElevenLabsApiKey(): void {
  const current = loadTtsSettings();
  saveTtsSettings({ ...current, elevenLabsApiKey: "" });
}
