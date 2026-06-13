/** Server-side fal.ai TTS — sync fal.run first, queue fallback with correct response URLs */

import {
  buildFalTtsInput,
  normalizeFalTtsModel,
  normalizeFalTtsVoice,
} from "@/lib/tts/falTtsModels";

const FAL_RUN_BASE = "https://fal.run";
const FAL_QUEUE_BASE = "https://queue.fal.run";

type FalAudioFile = {
  url?: string;
  content_type?: string;
};

type FalTtsResponse = {
  audio?: FalAudioFile;
  audio_url?: string;
};

type FalQueueSubmitResponse = {
  request_id?: string;
  status_url?: string;
  response_url?: string;
};

type FalQueueStatusResponse = {
  status?: string;
  error?: string;
};

export class FalTtsUpstreamError extends Error {
  readonly status: number;
  readonly rawBody: string;

  constructor(status: number, rawBody: string) {
    super(`Fal TTS upstream ${status}`);
    this.name = "FalTtsUpstreamError";
    this.status = status;
    this.rawBody = rawBody;
  }
}

function postHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function queueGetHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Key ${apiKey}` };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAudioUrl(data: FalTtsResponse): string | null {
  const fromFile = data.audio?.url?.trim();
  if (fromFile) return fromFile;
  const flat = data.audio_url?.trim();
  return flat || null;
}

function unwrapFalQueuePayload(raw: unknown): FalTtsResponse {
  if (!raw || typeof raw !== "object") {
    return (raw ?? {}) as FalTtsResponse;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.response && typeof obj.response === "object") {
    return obj.response as FalTtsResponse;
  }
  return obj as FalTtsResponse;
}

async function downloadFalAudio(
  audioUrl: string,
  contentTypeHint?: string,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(
      `fal.ai: Audio-Download fehlgeschlagen (${audioRes.status})`,
    );
  }
  const audio = await audioRes.arrayBuffer();
  const contentType =
    contentTypeHint?.trim() ||
    audioRes.headers.get("Content-Type") ||
    "audio/wav";
  return { audio, contentType };
}

async function pollFalQueueResult(
  apiKey: string,
  statusUrl: string,
  responseUrl: string,
  timeoutMs = 120_000,
): Promise<FalTtsResponse> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: queueGetHeaders(apiKey),
      cache: "no-store",
    });
    if (!statusRes.ok) {
      const errText = await statusRes.text().catch(() => "");
      throw new FalTtsUpstreamError(statusRes.status, errText);
    }

    const statusJson = (await statusRes.json()) as FalQueueStatusResponse;
    const status = statusJson.status?.toUpperCase();

    if (status === "COMPLETED") break;
    if (status === "FAILED" || status === "CANCELLED") {
      throw new FalTtsUpstreamError(
        502,
        statusJson.error || `fal.ai Queue: ${status ?? "FAILED"}`,
      );
    }

    await sleep(600);
  }

  const resultRes = await fetch(responseUrl, {
    method: "GET",
    headers: queueGetHeaders(apiKey),
    cache: "no-store",
  });
  if (!resultRes.ok) {
    const errText = await resultRes.text().catch(() => "");
    throw new FalTtsUpstreamError(resultRes.status, errText);
  }

  return unwrapFalQueuePayload(await resultRes.json());
}

function buildQueueUrls(
  model: string,
  submitJson: FalQueueSubmitResponse,
): { statusUrl: string; responseUrl: string; requestId: string } {
  const requestId = submitJson.request_id?.trim();
  if (!requestId) {
    throw new Error("fal.ai: keine request_id von der Queue");
  }
  const statusUrl =
    submitJson.status_url?.trim() ||
    `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`;
  const responseUrl =
    submitJson.response_url?.trim() ||
    `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/response`;
  return { statusUrl, responseUrl, requestId };
}

async function synthesizeFalTtsViaQueue(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: postHeaders(apiKey),
    body: JSON.stringify(input),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => "");
    throw new FalTtsUpstreamError(submitRes.status, errText);
  }

  const submitJson = (await submitRes.json()) as FalQueueSubmitResponse;
  const { statusUrl, responseUrl } = buildQueueUrls(model, submitJson);

  const result = await pollFalQueueResult(apiKey, statusUrl, responseUrl);
  const audioUrl = extractAudioUrl(result);
  if (!audioUrl) {
    throw new Error("fal.ai: keine Audio-URL in der Queue-Antwort");
  }

  return downloadFalAudio(audioUrl, result.audio?.content_type);
}

async function synthesizeFalTtsViaRun(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const upstream = await fetch(`${FAL_RUN_BASE}/${model}`, {
    method: "POST",
    headers: postHeaders(apiKey),
    body: JSON.stringify(input),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    throw new FalTtsUpstreamError(upstream.status, errText);
  }

  const json = unwrapFalQueuePayload(await upstream.json());
  const audioUrl = extractAudioUrl(json);
  if (!audioUrl) {
    throw new Error("fal.ai: keine Audio-URL in der Antwort");
  }

  return downloadFalAudio(audioUrl, json.audio?.content_type);
}

function shouldFallbackFromRun(status: number): boolean {
  return status === 422 || status === 405 || status === 503 || status === 429;
}

function shouldFallbackFromQueue(status: number): boolean {
  return status === 422 || status === 405 || status === 503;
}

export async function synthesizeFalTts(
  apiKey: string,
  modelId: string,
  text: string,
  voice: string,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const model = normalizeFalTtsModel(modelId);
  const resolvedVoice = normalizeFalTtsVoice(model, voice);
  const input = buildFalTtsInput(model, text, resolvedVoice);

  try {
    return await synthesizeFalTtsViaRun(apiKey, model, input);
  } catch (e) {
    if (
      e instanceof FalTtsUpstreamError &&
      shouldFallbackFromRun(e.status)
    ) {
      try {
        return await synthesizeFalTtsViaQueue(apiKey, model, input);
      } catch (queueErr) {
        if (
          queueErr instanceof FalTtsUpstreamError &&
          shouldFallbackFromQueue(queueErr.status)
        ) {
          return synthesizeFalTtsViaRun(apiKey, model, input);
        }
        throw queueErr;
      }
    }
    throw e;
  }
}
