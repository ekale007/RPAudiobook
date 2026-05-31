import { chunkTextForTts } from "@/lib/tts/chunkText";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import {
  isSpeakableForTts,
  sanitizeTextForTtsRetry,
} from "@/lib/tts/speakableText";
import { voiceForSpeaker } from "@/lib/tts/defaultVoiceMap";
import type { TtsSettings } from "@/lib/storage/ttsSettings";
import type { VoiceMap } from "@/lib/types";
import { ttsCacheVoiceKey } from "@/lib/storage/ttsSettings";
import type { CharacterRow } from "@/lib/db/stories";
import { filterSegmentOverridesForActivation } from "@/lib/tts/voiceActivation";
import type { VoiceEnabledSlugs } from "@/lib/tts/voiceActivation";
import {
  applyCastCardNameAliases,
  applyKokoroNameHints,
  buildEffectivePronunciationMap,
  isKokoroEngine,
} from "@/lib/tts/kokoroPronunciation";
import { applyPronunciationOverrides } from "@/lib/tts/pronunciation";
import {
  buildTtsCacheKey,
  getCachedAudio,
  setCachedAudio,
} from "@/lib/storage/ttsAudioCache";
import {
  localTtsRouteCacheSuffix,
  resolveLocalTtsRoute,
  type TtsStoryLocale,
} from "@/lib/tts/ttsLocaleRouting";
import {
  ELEVEN_DEFAULT_MODEL,
  mergeElevenVoiceMap,
} from "@/lib/tts/elevenLabsVoices";
import { authFetch } from "@/lib/supabase/authFetch";
import { isServerTtsAvailable } from "@/lib/server/serverCapabilities";

async function synthesizeChunkLocal(
  settings: TtsSettings,
  text: string,
  voice: string,
  storyLocale?: TtsStoryLocale,
): Promise<Blob> {
  const route = resolveLocalTtsRoute(settings, storyLocale, voice);
  const attempt = async (payload: string, routedVoice: string) => {
    const res = await fetch("/api/tts/local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: payload,
        voice: routedVoice,
        serverUrl: route.serverUrl,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        err ||
          (route.engine === "edge"
            ? "Deutsch-TTS (edge-tts) fehlgeschlagen. Läuft npm run tts:server auf Port 5123?"
            : "Local TTS failed. Is the server running? (npm run tts:server)"),
      );
    }
    return res.blob();
  };

  try {
    return await attempt(text, route.voice);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("no audio chunks")) throw e;
    const cleaned = sanitizeTextForTtsRetry(text);
    if (cleaned && cleaned !== text.trim() && isSpeakableForTts(cleaned)) {
      return await attempt(cleaned, route.voice);
    }
    throw e;
  }
}

async function synthesizeChunkElevenLabs(
  settings: TtsSettings,
  text: string,
  voiceId: string,
  storyLocale?: TtsStoryLocale,
): Promise<Blob> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!isServerTtsAvailable() && settings.elevenLabsApiKey?.trim()) {
    headers["xi-api-key"] = settings.elevenLabsApiKey.trim();
  }

  const res = await authFetch("/api/tts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      text,
      voiceId,
      modelId: settings.elevenLabsModelId || ELEVEN_DEFAULT_MODEL,
      locale: storyLocale?.startsWith("de") ? "de" : "en",
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
  storyLocale?: TtsStoryLocale,
): Promise<Blob> {
  if (settings.provider === "local") {
    return synthesizeChunkLocal(settings, text, voice, storyLocale);
  }
  return synthesizeChunkElevenLabs(settings, text, voice, storyLocale);
}

async function concatAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 1) return blobs[0];
  if (typeof window === "undefined" || !("AudioContext" in window)) {
    const type = blobs[0]?.type || "audio/mpeg";
    return new Blob(blobs, { type });
  }

  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    const type = blobs[0]?.type || "audio/mpeg";
    return new Blob(blobs, { type });
  }

  const decodeCtx = new Ctx();
  try {
    const decoded: AudioBuffer[] = [];
    for (const b of blobs) {
      const ab = await b.arrayBuffer();
      decoded.push(await decodeCtx.decodeAudioData(ab.slice(0)));
    }
    if (!decoded.length) return new Blob([], { type: "audio/wav" });

    const sampleRate = decoded[0].sampleRate;
    const channels = Math.max(...decoded.map((d) => d.numberOfChannels));
    const totalDuration = decoded.reduce((sum, d) => sum + d.duration, 0);
    const totalFrames = Math.max(1, Math.ceil(totalDuration * sampleRate));

    const offline = new OfflineAudioContext(channels, totalFrames, sampleRate);
    let offset = 0;
    for (const buf of decoded) {
      const src = offline.createBufferSource();
      src.buffer = buf;
      src.connect(offline.destination);
      src.start(offset);
      offset += buf.duration;
    }

    const rendered = await offline.startRendering();
    const wav = audioBufferToWav(rendered);
    return new Blob([wav], { type: "audio/wav" });
  } catch {
    const type = blobs[0]?.type || "audio/mpeg";
    return new Blob(blobs, { type });
  } finally {
    await decodeCtx.close().catch(() => undefined);
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = Array.from({ length: numChannels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i] ?? 0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return wav;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function resolveVoice(
  settings: TtsSettings,
  speakerSlug: string | null | undefined,
  voiceMap?: VoiceMap,
  voiceEnabledSlugs?: VoiceEnabledSlugs,
): string {
  if (voiceMap) {
    const fallback =
      settings.provider === "local"
        ? settings.localVoice
        : settings.elevenLabsVoiceId;
    return voiceForSpeaker(
      speakerSlug,
      voiceMap,
      fallback,
      voiceEnabledSlugs,
    );
  }
  return settings.provider === "local"
    ? settings.localVoice
    : settings.elevenLabsVoiceId;
}

function cacheVoiceKey(
  settings: TtsSettings,
  voice: string,
  storyLocale?: TtsStoryLocale,
): string {
  const localeSuffix = localTtsRouteCacheSuffix(settings, storyLocale);
  if (settings.provider === "local") {
    return `${ttsCacheVoiceKey(settings)}:${voice}${localeSuffix}`;
  }
  return `${ttsCacheVoiceKey(settings)}:${voice}:${normalizeStoryLocaleKey(storyLocale)}`;
}

/** Generate or load turn audio (local server or ElevenLabs). */
export async function getNarratorAudio(
  settings: TtsSettings,
  text: string,
  options?: {
    speakerSlug?: string | null;
    voiceMap?: VoiceMap;
    segmentOverrides?: Record<string, string>;
    cast?: CharacterRow[];
    voiceEnabledSlugs?: VoiceEnabledSlugs;
    /** Untagged source — used for multi-voice split before normalization. */
    rawContent?: string;
    /** Story locale — routes German away from English-only Kokoro. */
    storyLocale?: TtsStoryLocale;
  },
): Promise<Blob> {
  const splitSource = stripSpeakerTags(options?.rawContent ?? text);
  const activeOverrides = filterSegmentOverridesForActivation(
    options?.segmentOverrides,
    options?.voiceEnabledSlugs,
  );
  const hasSegmentOverrides = Object.entries(activeOverrides).some(
    ([snippet, slug]) =>
      snippet.trim().length > 0 && slug && slug !== "narrator",
  );

  const storyLocale = options?.storyLocale;
  const normalizedText = normalizeTextForTts(
    hasSegmentOverrides ? splitSource : text,
    settings,
    options?.cast ?? [],
    storyLocale,
  );
  const voice = resolveVoice(
    settings,
    options?.speakerSlug,
    options?.voiceMap,
    options?.voiceEnabledSlugs,
  );
  const voiceKey = hasSegmentOverrides
    ? `${ttsCacheVoiceKey(settings)}:multi:${JSON.stringify(
        activeOverrides,
      )}:${normalizeStoryLocaleKey(storyLocale)}:${JSON.stringify(options?.voiceEnabledSlugs ?? null)}${localTtsRouteCacheSuffix(settings, storyLocale)}`
    : cacheVoiceKey(settings, voice, storyLocale);
  const cacheKey = buildTtsCacheKey(voiceKey, settings.provider, normalizedText);
  const cached = await getCachedAudio(cacheKey);
  if (cached) return cached;

  const parts: Blob[] = [];
  if (!hasSegmentOverrides) {
    const chunks = chunkTextForTts(
      normalizedText,
      settings.provider === "local" ? 4000 : 2400,
    );
    for (const chunk of chunks) {
      if (!isSpeakableForTts(chunk)) continue;
      parts.push(await synthesizeChunk(settings, chunk, voice, storyLocale));
    }
  } else {
    const segments = splitByOverrides(splitSource, activeOverrides);
    for (const seg of segments) {
      let segText = normalizeTextForTts(
        prepareSegmentForTts(seg.text, seg.speakerSlug, options?.cast ?? []),
        settings,
        options?.cast ?? [],
        storyLocale,
      );
      if (!isSpeakableForTts(segText)) continue;

      const segVoice = resolveVoice(
        settings,
        seg.speakerSlug,
        options?.voiceMap,
        options?.voiceEnabledSlugs,
      );
      const chunks = chunkTextForTts(
        segText,
        settings.provider === "local" ? 4000 : 2400,
      );
      for (const chunk of chunks) {
        if (!isSpeakableForTts(chunk)) continue;
        parts.push(
          await synthesizeChunk(settings, chunk, segVoice, storyLocale),
        );
      }
    }
  }

  if (!parts.length) {
    throw new Error("Kein sprechbarer Text für TTS (leer oder nur Satzzeichen).");
  }

  const merged = await concatAudioBlobs(parts);
  await setCachedAudio(cacheKey, merged);
  return merged;
}

const EDGE_NAME_HINTS: Array<{ source: string; replacement: string }> = [
  { source: "Elias", replacement: "Eh-LEE-as" },
  { source: "Naya", replacement: "NAI-ya" },
  { source: "Kaelen", replacement: "KAY-len" },
  { source: "Lucifer", replacement: "LOO-si-fer" },
  { source: "Vellani", replacement: "veh-LAH-nee" },
  { source: "Kethari", replacement: "keh-THAH-ree" },
];

function normalizeStoryLocaleKey(locale?: TtsStoryLocale): string {
  return locale?.toLowerCase().startsWith("de") ? "de" : "en";
}

export function normalizeTextForTts(
  text: string,
  settings: TtsSettings,
  cast: CharacterRow[],
  storyLocale?: TtsStoryLocale,
): string {
  let out = text
    .replace(/\bnayas\b/gi, "Naya's")
    .replace(/\beliass\b/gi, "Elias's");

  out = applyCastCardNameAliases(out, cast);
  const pronunciationMap = buildEffectivePronunciationMap(settings, cast);
  out = applyPronunciationOverrides(out, pronunciationMap);

  const isDe = storyLocale?.toLowerCase().startsWith("de");
  if (!isDe) {
    if (isKokoroEngine(settings)) {
      out = applyKokoroNameHints(out, pronunciationMap);
    } else {
      out = applyEdgeStyleNameHints(out, pronunciationMap);
    }
  }
  return out;
}

function applyEdgeStyleNameHints(
  text: string,
  map: Record<string, string>,
): string {
  const customKeys = new Set(
    Object.keys(map).map((k) => k.trim().toLowerCase()),
  );
  let out = text;
  for (const hint of EDGE_NAME_HINTS) {
    if (customKeys.has(hint.source.toLowerCase())) continue;
    const re = new RegExp(`\\b${hint.source}\\b`, "gi");
    out = out.replace(re, hint.replacement);
  }
  return out;
}

function splitByOverrides(
  text: string,
  overrides: Record<string, string>,
): Array<{ text: string; speakerSlug: string | null }> {
  const occurrences: Array<{
    start: number;
    end: number;
    snippet: string;
    speakerSlug: string;
  }> = [];
  for (const [snippet, slug] of Object.entries(overrides)) {
    if (!snippet.trim() || !slug || slug === "narrator") continue;
    const idx = text.indexOf(snippet);
    if (idx < 0) continue;
    occurrences.push({
      start: idx,
      end: idx + snippet.length,
      snippet,
      speakerSlug: slug,
    });
  }
  if (!occurrences.length) return [{ text, speakerSlug: null }];
  occurrences.sort((a, b) => a.start - b.start);

  const out: Array<{ text: string; speakerSlug: string | null }> = [];
  let cursor = 0;
  for (const occ of occurrences) {
    if (occ.start < cursor) continue;
    const before = text.slice(cursor, occ.start).trim();
    if (before) out.push({ text: before, speakerSlug: null });
    const mid = text.slice(occ.start, occ.end).trim();
    if (mid) out.push({ text: mid, speakerSlug: occ.speakerSlug });
    cursor = occ.end;
  }
  const tail = text.slice(cursor).trim();
  if (tail) out.push({ text: tail, speakerSlug: null });
  return out.length ? out : [{ text, speakerSlug: null }];
}

function prepareSegmentForTts(
  segment: string,
  _speakerSlug: string | null,
  _cast: CharacterRow[],
): string {
  return segment.trim();
}
