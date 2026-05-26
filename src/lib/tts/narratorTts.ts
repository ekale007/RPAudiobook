import { chunkTextForTts } from "@/lib/tts/chunkText";
import { voiceForSpeaker } from "@/lib/tts/defaultVoiceMap";
import type { TtsSettings } from "@/lib/storage/ttsSettings";
import type { VoiceMap } from "@/lib/types";
import { ttsCacheVoiceKey } from "@/lib/storage/ttsSettings";
import {
  buildTtsCacheKey,
  getCachedAudio,
  setCachedAudio,
} from "@/lib/storage/ttsAudioCache";

async function synthesizeChunkLocal(
  settings: TtsSettings,
  text: string,
  voice: string,
): Promise<Blob> {
  const base = settings.localServerUrl.replace(/\/$/, "");
  const res = await fetch("/api/tts/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice,
      serverUrl: base,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      err ||
        "Local TTS failed. Is the server running? (npm run tts:server)",
    );
  }

  return res.blob();
}

async function synthesizeChunkElevenLabs(
  settings: TtsSettings,
  text: string,
): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": settings.elevenLabsApiKey,
    },
    body: JSON.stringify({
      text,
      voiceId: settings.elevenLabsVoiceId,
      modelId: settings.elevenLabsModelId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `TTS failed (${res.status})`);
  }

  return res.blob();
}

async function synthesizeChunk(
  settings: TtsSettings,
  text: string,
  voice: string,
): Promise<Blob> {
  if (settings.provider === "local") {
    return synthesizeChunkLocal(settings, text, voice);
  }
  return synthesizeChunkElevenLabs(settings, text);
}

async function concatAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 1) return blobs[0];
  const type = blobs[0]?.type || "audio/mpeg";
  return new Blob(blobs, { type });
}

function resolveVoice(
  settings: TtsSettings,
  speakerSlug: string | null | undefined,
  voiceMap?: VoiceMap,
): string {
  if (settings.provider === "local" && voiceMap) {
    return voiceForSpeaker(speakerSlug, voiceMap, settings.localVoice);
  }
  return settings.localVoice;
}

function cacheVoiceKey(
  settings: TtsSettings,
  voice: string,
): string {
  if (settings.provider === "local") {
    return `${ttsCacheVoiceKey(settings)}:${voice}`;
  }
  return ttsCacheVoiceKey(settings);
}

/** Generate or load turn audio (local server or ElevenLabs). */
export async function getNarratorAudio(
  settings: TtsSettings,
  text: string,
  options?: { speakerSlug?: string | null; voiceMap?: VoiceMap },
): Promise<Blob> {
  const voice = resolveVoice(settings, options?.speakerSlug, options?.voiceMap);
  const voiceKey = cacheVoiceKey(settings, voice);
  const cacheKey = buildTtsCacheKey(voiceKey, settings.provider, text);
  const cached = await getCachedAudio(cacheKey);
  if (cached) return cached;

  const chunks = chunkTextForTts(text, settings.provider === "local" ? 4000 : 2400);
  const parts: Blob[] = [];
  for (const chunk of chunks) {
    parts.push(await synthesizeChunk(settings, chunk, voice));
  }

  const merged = await concatAudioBlobs(parts);
  await setCachedAudio(cacheKey, merged);
  return merged;
}
