/** Server-side fal.ai TTS — sync REST via fal.run */

import {
  buildFalTtsInput,
  normalizeFalTtsModel,
  normalizeFalTtsVoice,
} from "@/lib/tts/falTtsModels";

const FAL_RUN_BASE = "https://fal.run";

type FalTtsResponse = {
  audio?: {
    url?: string;
    content_type?: string;
  };
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

export async function synthesizeFalTts(
  apiKey: string,
  modelId: string,
  text: string,
  voice: string,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const model = normalizeFalTtsModel(modelId);
  const resolvedVoice = normalizeFalTtsVoice(model, voice);
  const body = buildFalTtsInput(model, text, resolvedVoice);

  const upstream = await fetch(`${FAL_RUN_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    throw new FalTtsUpstreamError(upstream.status, errText);
  }

  const json = (await upstream.json()) as FalTtsResponse;
  const audioUrl = json.audio?.url?.trim();
  if (!audioUrl) {
    throw new Error("fal.ai: keine Audio-URL in der Antwort");
  }

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(
      `fal.ai: Audio-Download fehlgeschlagen (${audioRes.status})`,
    );
  }

  const audio = await audioRes.arrayBuffer();
  const contentType =
    json.audio?.content_type?.trim() ||
    audioRes.headers.get("Content-Type") ||
    "audio/wav";

  return { audio, contentType };
}
