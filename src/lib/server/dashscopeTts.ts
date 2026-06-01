/**
 * Alibaba DashScope / Qwen Cloud non-realtime TTS.
 * @see https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api
 */

import {
  coerceQwenPresetVoice,
  normalizeQwenVoiceId,
} from "@/lib/tts/qwenVoiceSanitize";
import { QWEN_CLOUD_MAX_TEXT_CHARS } from "@/lib/tts/qwenCloudLimits";
import { resolveQwenCloudVoice } from "@/lib/tts/qwenCloudVoices";

export type DashScopeTtsRequest = {
  text: string;
  voice: string;
  languageType: string;
  instruct?: string | null;
};

export type DashScopeTtsResult = {
  audio: ArrayBuffer;
  contentType: string;
  model: string;
};

const FLASH_MODEL = "qwen3-tts-flash";
const INSTRUCT_MODEL = "qwen3-tts-instruct-flash";

/** Infer language_type from segment text (English story vs DE locale). */
export function detectDashScopeLanguageFromText(
  text: string,
  storyLocale?: string,
): string | null {
  const sample = text.trim().slice(0, 800);
  if (sample.length < 16) return null;
  const de =
    (sample.match(/\b(und|der|die|das|ist|nicht|sie|ein|ich|mit)\b/gi) ?? [])
      .length;
  const en =
    (sample.match(/\b(the|and|is|her|his|you|with|she|was|for)\b/gi) ?? [])
      .length;
  if (en >= 3 && en > de * 1.2) return "English";
  if (de >= 3 && de > en * 1.2) return "German";
  return null;
}

/** Map app locale / Auto to DashScope language_type. */
export function resolveDashScopeLanguageType(
  language: string | undefined,
  storyLocale?: string,
  segmentText?: string,
): string {
  const detected = segmentText
    ? detectDashScopeLanguageFromText(segmentText, storyLocale)
    : null;
  if (detected) return detected;
  const raw = (language ?? "").trim();
  if (raw && raw !== "Auto") {
    const lower = raw.toLowerCase();
    if (lower.startsWith("de") || lower === "german") return "German";
    if (lower.startsWith("en") || lower === "english") return "English";
    if (lower.startsWith("zh") || lower.includes("chinese")) return "Chinese";
    if (lower.startsWith("ja") || lower === "japanese") return "Japanese";
    if (lower.startsWith("ko") || lower === "korean") return "Korean";
    if (lower.startsWith("fr") || lower === "french") return "French";
    if (lower.startsWith("es") || lower === "spanish") return "Spanish";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  if (storyLocale?.toLowerCase().startsWith("de")) return "German";
  return "English";
}

export function getDashScopeApiKey(): string | null {
  const key = process.env.DASHSCOPE_API_KEY?.trim();
  return key || null;
}

export function getDashScopeBaseUrl(): string {
  const base =
    process.env.DASHSCOPE_BASE_URL?.trim() ||
    "https://dashscope-intl.aliyuncs.com/api/v1";
  return base.replace(/\/$/, "");
}

export function getQwenCloudDefaultModel(): string {
  return (
    process.env.QWEN_CLOUD_MODEL?.trim() || INSTRUCT_MODEL
  );
}

export function isServerQwenCloudTtsConfigured(): boolean {
  return Boolean(getDashScopeApiKey());
}

function generationUrl(): string {
  return `${getDashScopeBaseUrl()}/services/aigc/multimodal-generation/generation`;
}

function pickModel(hasInstruct: boolean): string {
  const envDefault = getQwenCloudDefaultModel();
  if (hasInstruct) {
    if (envDefault.includes("instruct")) return envDefault;
    return INSTRUCT_MODEL;
  }
  const flashOverride = process.env.QWEN_CLOUD_MODEL_FLASH?.trim();
  if (flashOverride) return flashOverride;
  if (envDefault.includes("instruct")) return FLASH_MODEL;
  return envDefault.includes("instruct") ? FLASH_MODEL : envDefault || FLASH_MODEL;
}

function resolveCloudTtsPlan(
  voice: string,
  instruct: string | null,
  speakerSlug?: string,
): { model: string; voice: string; instruct: string | null } {
  const preset = normalizeQwenVoiceId(coerceQwenPresetVoice(voice, speakerSlug));
  const hasInstruct = Boolean(instruct?.trim());
  const model = pickModel(hasInstruct);
  const useInstructModel = model.includes("instruct");
  const cloudVoice = resolveQwenCloudVoice(preset, useInstructModel);
  return { model, voice: cloudVoice, instruct: hasInstruct ? instruct : null };
}

/** Normalize voice id for DashScope; reject ElevenLabs/Kokoro ids from legacy voiceMap. */
export function resolveDashScopeVoice(voice: string, speakerSlug?: string): string {
  return coerceQwenPresetVoice(voice, speakerSlug);
}

type GenerationJson = {
  output?: {
    audio?: { url?: string; data?: string; mime_type?: string };
  };
  code?: string;
  message?: string;
};

export async function synthesizeDashScopeTts(
  req: DashScopeTtsRequest,
  options?: { storyLocale?: string; speakerSlug?: string },
): Promise<DashScopeTtsResult> {
  const apiKey = getDashScopeApiKey();
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const text = req.text.trim();
  if (!text) throw new Error("Missing text");
  if (text.length > QWEN_CLOUD_MAX_TEXT_CHARS) {
    throw new Error(
      `Text too long for Qwen Cloud (max ${QWEN_CLOUD_MAX_TEXT_CHARS} characters per request)`,
    );
  }

  const instruct = req.instruct?.trim() || null;
  const plan = resolveCloudTtsPlan(req.voice, instruct, options?.speakerSlug);
  const language_type = resolveDashScopeLanguageType(
    req.languageType,
    options?.storyLocale,
    text,
  );

  const input: Record<string, string | boolean> = {
    text,
    voice: plan.voice,
    language_type,
  };
  if (plan.instruct) {
    input.instructions = plan.instruct;
    input.optimize_instructions =
      process.env.QWEN_CLOUD_OPTIMIZE_INSTRUCTIONS === "1";
  }

  const upstream = await fetch(generationUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: plan.model, input }),
    signal: AbortSignal.timeout(120_000),
  });

  const rawText = await upstream.text();
  let json: GenerationJson;
  try {
    json = JSON.parse(rawText) as GenerationJson;
  } catch {
    throw new Error(
      upstream.ok
        ? "Invalid DashScope response"
        : rawText || upstream.statusText,
    );
  }

  if (!upstream.ok || json.code) {
    const msg =
      json.message ||
      rawText ||
      `DashScope TTS failed (${upstream.status})`;
    throw new Error(msg);
  }

  const audioMeta = json.output?.audio;
  if (!audioMeta) {
    throw new Error("DashScope response missing output.audio");
  }

  if (audioMeta.url) {
    const audioRes = await fetch(audioMeta.url, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!audioRes.ok) {
      throw new Error(`Failed to download TTS audio (${audioRes.status})`);
    }
    const buffer = await audioRes.arrayBuffer();
    const contentType =
      audioRes.headers.get("content-type") ||
      audioMeta.mime_type ||
      "audio/wav";
    return { audio: buffer, contentType, model: plan.model };
  }

  if (audioMeta.data) {
    const buffer = Buffer.from(audioMeta.data, "base64");
    return {
      audio: buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
      contentType: audioMeta.mime_type || "audio/wav",
      model: plan.model,
    };
  }

  throw new Error("DashScope response has no audio url or data");
}
