import { concatAudioBlobs } from "@/lib/audio/concatAudioBlobs";
import { chunkTextForTts } from "@/lib/tts/chunkText";
import { QWEN_CLOUD_MAX_TEXT_CHARS } from "@/lib/tts/qwenCloudLimits";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import {
  isSpeakableForTts,
  sanitizeTextForTtsRetry,
} from "@/lib/tts/speakableText";
import { voiceForSpeaker } from "@/lib/tts/defaultVoiceMap";
import type { TtsProvider, TtsSettings } from "@/lib/storage/ttsSettings";
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
  normalizeStoryLocale,
  resolveLocalTtsRoute,
  type TtsStoryLocale,
} from "@/lib/tts/ttsLocaleRouting";
import { resolveElevenLabsTtsExtras } from "@/lib/tts/elevenLabsDelivery";
import {
  ELEVEN_DEFAULT_MODEL,
  getElevenLabsVoiceSettings,
  mergeElevenVoiceMap,
} from "@/lib/tts/elevenLabsVoices";
import { readCostCentsHeader, TTS_COST_HEADER } from "@/lib/llm/openRouterCompletion";
import { authFetch } from "@/lib/supabase/authFetch";
import {
  isServerElevenLabsAvailable,
  isServerQwenTtsAvailable,
} from "@/lib/server/serverCapabilities";
import { coerceElevenLabsVoiceId } from "@/lib/tts/elevenLabsVoices";
import { normalizeElevenLabsModelId } from "@/lib/tts/elevenLabsModels";
import { resolveQwenTtsParams } from "@/lib/tts/qwenVoiceProfiles";
import { coerceQwenPresetVoice } from "@/lib/tts/qwenVoiceSanitize";
import type { StorySettings } from "@/lib/types";
import { stripSfxTags } from "@/lib/audio/sfxCatalog";

function ttsChunkCharLimit(provider: TtsProvider): number {
  if (provider === "qwen-cloud") return QWEN_CLOUD_MAX_TEXT_CHARS;
  if (provider === "local" || provider === "qwen") return 4000;
  return 2400;
}

async function synthesizeChunkLocal(
  settings: TtsSettings,
  text: string,
  voice: string,
  storyLocale?: TtsStoryLocale,
  qwenExtras?: { language?: string; instruct?: string | null },
): Promise<Blob> {
  const route = resolveLocalTtsRoute(settings, storyLocale, voice);
  const attempt = async (payload: string, routedVoice: string) => {
    const body: Record<string, string | null | undefined> = {
      text: payload,
      voice: routedVoice,
      serverUrl: route.serverUrl,
    };
    if (route.engine === "qwen" || settings.provider === "qwen") {
      body.language = qwenExtras?.language ?? "Auto";
      body.instruct = qwenExtras?.instruct ?? null;
    }
    const res = await fetch("/api/tts/local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

async function synthesizeChunkQwenCloud(
  text: string,
  voice: string,
  storyLocale?: TtsStoryLocale,
  qwenExtras?: { language?: string; instruct?: string | null },
): Promise<Blob> {
  const res = await authFetch("/api/tts/qwen-cloud", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice,
      language: qwenExtras?.language ?? "Auto",
      instruct: qwenExtras?.instruct ?? null,
      storyLocale,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Qwen Cloud TTS failed (${res.status})`);
  }
  return res.blob();
}

async function synthesizeChunkQwen(
  settings: TtsSettings,
  text: string,
  voice: string,
  storyLocale?: TtsStoryLocale,
  qwenExtras?: { language?: string; instruct?: string | null },
): Promise<Blob> {
  if (settings.provider === "qwen-cloud") {
    return synthesizeChunkQwenCloud(text, voice, storyLocale, qwenExtras);
  }

  if (isServerQwenTtsAvailable()) {
    const res = await authFetch("/api/tts/qwen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice,
        language: qwenExtras?.language ?? "Auto",
        instruct: qwenExtras?.instruct ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `Qwen TTS failed (${res.status})`);
    }
    return res.blob();
  }

  const qwenSettings: TtsSettings = {
    ...settings,
    provider: "local",
    localEngine: "qwen",
    localServerUrl: settings.localServerUrl.trim() || "http://127.0.0.1:5125",
  };
  return synthesizeChunkLocal(
    qwenSettings,
    text,
    voice,
    storyLocale,
    qwenExtras,
  );
}

async function synthesizeChunkElevenLabs(
  settings: TtsSettings,
  text: string,
  voiceId: string,
  storyLocale?: TtsStoryLocale,
  options?: {
    speakerSlug?: string | null;
    storySettings?: StorySettings | null;
    segmentText?: string;
  },
): Promise<{ blob: Blob; ttsCostCents: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!isServerElevenLabsAvailable() && settings.elevenLabsApiKey?.trim()) {
    headers["xi-api-key"] = settings.elevenLabsApiKey.trim();
  }

  const locale = storyLocale?.startsWith("de") ? "de" : "en";
  const baseVoiceSettings = getElevenLabsVoiceSettings(locale);
  const extras = resolveElevenLabsTtsExtras(
    text,
    settings.elevenLabsModelId || ELEVEN_DEFAULT_MODEL,
    baseVoiceSettings,
    options?.speakerSlug,
    options?.storySettings,
    storyLocale,
    { segmentText: options?.segmentText ?? text },
  );

  const res = await authFetch("/api/tts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: extras.text,
      voiceId,
      speakerSlug: options?.speakerSlug ?? null,
      modelId: normalizeElevenLabsModelId(
        extras.modelId ?? settings.elevenLabsModelId ?? ELEVEN_DEFAULT_MODEL,
      ),
      locale,
      voiceSettings: extras.voiceSettings,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let message = raw || `TTS failed (${res.status})`;
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error?.trim()) message = parsed.error.trim();
    } catch {
      /* plain text */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const ttsCostCents = readCostCentsHeader(res, TTS_COST_HEADER) ?? 0;
  return { blob, ttsCostCents };
}

type TtsChunkContext = {
  speakerSlug?: string | null;
  storySettings?: StorySettings | null;
  segmentText?: string;
};

async function synthesizeChunk(
  settings: TtsSettings,
  text: string,
  voice: string,
  storyLocale?: TtsStoryLocale,
  qwenExtras?: { language?: string; instruct?: string | null },
  deliveryContext?: TtsChunkContext,
): Promise<{ blob: Blob; ttsCostCents: number }> {
  if (settings.provider === "local") {
    const blob = await synthesizeChunkLocal(
      settings,
      text,
      voice,
      storyLocale,
      qwenExtras,
    );
    return { blob, ttsCostCents: 0 };
  }
  if (settings.provider === "qwen" || settings.provider === "qwen-cloud") {
    const blob = await synthesizeChunkQwen(
      settings,
      text,
      voice,
      storyLocale,
      qwenExtras,
    );
    return { blob, ttsCostCents: 0 };
  }
  return synthesizeChunkElevenLabs(settings, text, voice, storyLocale, {
    speakerSlug: deliveryContext?.speakerSlug,
    storySettings: deliveryContext?.storySettings,
    segmentText: deliveryContext?.segmentText ?? text,
  });
}

function resolveVoice(
  settings: TtsSettings,
  speakerSlug: string | null | undefined,
  voiceMap?: VoiceMap,
  voiceEnabledSlugs?: VoiceEnabledSlugs,
  storyLocale?: TtsStoryLocale,
): string {
  const elLocale = normalizeStoryLocale(storyLocale);
  if (voiceMap) {
    const fallback =
      settings.provider === "local" ||
      settings.provider === "qwen" ||
      settings.provider === "qwen-cloud"
        ? settings.localVoice
        : settings.elevenLabsVoiceId;
    const resolved = voiceForSpeaker(
      speakerSlug,
      voiceMap,
      fallback,
      voiceEnabledSlugs,
    );
    if (
      settings.provider === "qwen" ||
      settings.provider === "qwen-cloud"
    ) {
      return coerceQwenPresetVoice(resolved, speakerSlug);
    }
    if (settings.provider === "elevenlabs") {
      return coerceElevenLabsVoiceId(resolved, speakerSlug, elLocale);
    }
    return resolved;
  }
  if (
    settings.provider === "local" ||
    settings.provider === "qwen" ||
    settings.provider === "qwen-cloud"
  ) {
    const v = settings.localVoice;
    return settings.provider === "qwen" || settings.provider === "qwen-cloud"
      ? coerceQwenPresetVoice(v, speakerSlug)
      : v;
  }
  return coerceElevenLabsVoiceId(
    settings.elevenLabsVoiceId,
    speakerSlug,
    elLocale,
  );
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
  if (settings.provider === "qwen" || settings.provider === "qwen-cloud") {
    return `${ttsCacheVoiceKey(settings)}:${voice}:${normalizeStoryLocaleKey(storyLocale)}`;
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
    /** Qwen instruct + plot-state mood (RunPod / local Qwen). */
    storySettings?: StorySettings | null;
  },
): Promise<{ blob: Blob; ttsCostCents?: number }> {
  const splitSource = stripSpeakerTags(
    stripSfxTags(options?.rawContent ?? text),
  );
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
    hasSegmentOverrides ? splitSource : stripSfxTags(text),
    settings,
    options?.cast ?? [],
    storyLocale,
  );
  const voice = resolveVoice(
    settings,
    options?.speakerSlug,
    options?.voiceMap,
    options?.voiceEnabledSlugs,
    storyLocale,
  );
  const voiceKey = hasSegmentOverrides
    ? `${ttsCacheVoiceKey(settings)}:multi:${JSON.stringify(
        activeOverrides,
      )}:${normalizeStoryLocaleKey(storyLocale)}:${JSON.stringify(options?.voiceEnabledSlugs ?? null)}${localTtsRouteCacheSuffix(settings, storyLocale)}`
    : cacheVoiceKey(settings, voice, storyLocale);
  const cacheKey = buildTtsCacheKey(voiceKey, settings.provider, normalizedText);
  const cached = await getCachedAudio(cacheKey);
  if (cached) return { blob: cached };

  const chunkLimit = ttsChunkCharLimit(settings.provider);
  let ttsCostCentsTotal = 0;

  const qwenForSpeaker = (
    slug: string | null | undefined,
    segmentText?: string,
  ) =>
    settings.provider === "qwen" || settings.provider === "qwen-cloud"
      ? resolveQwenTtsParams(
          slug,
          options?.storySettings ?? null,
          storyLocale,
          { segmentText, provider: settings.provider },
        )
      : null;

  const deliveryCtx = (slug: string | null | undefined, segmentText: string) =>
    ({
      speakerSlug: slug ?? options?.speakerSlug,
      storySettings: options?.storySettings,
      segmentText,
    }) satisfies TtsChunkContext;

  const parts: Blob[] = [];
  if (!hasSegmentOverrides) {
    const qwen = qwenForSpeaker(options?.speakerSlug, normalizedText);
    const chunks = chunkTextForTts(normalizedText, chunkLimit);
    for (const chunk of chunks) {
      if (!isSpeakableForTts(chunk)) continue;
      const chunkQwen = qwenForSpeaker(options?.speakerSlug, chunk) ?? qwen;
      const chunkResult = await synthesizeChunk(
        settings,
        chunk,
        chunkQwen?.voice ?? voice,
        storyLocale,
        chunkQwen ?? undefined,
        deliveryCtx(options?.speakerSlug ?? null, chunk),
      );
      parts.push(chunkResult.blob);
      ttsCostCentsTotal += chunkResult.ttsCostCents;
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
        storyLocale,
      );
      const qwen = qwenForSpeaker(seg.speakerSlug, segText);
      const chunks = chunkTextForTts(segText, chunkLimit);
      for (const chunk of chunks) {
        if (!isSpeakableForTts(chunk)) continue;
        const chunkQwen = qwenForSpeaker(seg.speakerSlug, chunk) ?? qwen;
        const chunkResult = await synthesizeChunk(
          settings,
          chunk,
          chunkQwen?.voice ?? segVoice,
          storyLocale,
          chunkQwen ?? undefined,
          deliveryCtx(seg.speakerSlug, chunk),
        );
        parts.push(chunkResult.blob);
        ttsCostCentsTotal += chunkResult.ttsCostCents;
      }
    }
  }

  if (!parts.length) {
    throw new Error("Kein sprechbarer Text für TTS (leer oder nur Satzzeichen).");
  }

  const merged = await concatAudioBlobs(parts);
  await setCachedAudio(cacheKey, merged);
  return {
    blob: merged,
    ttsCostCents: ttsCostCentsTotal > 0 ? ttsCostCentsTotal : undefined,
  };
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
