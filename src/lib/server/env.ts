/** Server-only secrets and defaults (never import from client components). */

import { isServerQwenCloudTtsConfigured } from "@/lib/server/dashscopeTts";

export function getElevenLabsApiKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  return key || null;
}

export function getOpenRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key || null;
}

export function getOpenRouterModel(): string {
  return (
    process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash-lite"
  );
}

export function getOpenRouterNarratorModel(): string | undefined {
  const m = process.env.OPENROUTER_NARRATOR_MODEL?.trim();
  return m || undefined;
}

export function getOpenRouterTtsModel(): string {
  return (
    process.env.OPENROUTER_TTS_MODEL?.trim() || "hexgrad/kokoro-82m"
  );
}

export function getFishAudioApiKey(): string | null {
  const key =
    process.env.FISH_AUDIO_API_KEY?.trim() ||
    process.env.FISH_API_KEY?.trim();
  return key || null;
}

export function isServerOpenRouterTtsConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}

export function isServerFishAudioTtsConfigured(): boolean {
  return Boolean(getFishAudioApiKey());
}

export function getRateLimitLlmPerHour(): number {
  return parseInt(process.env.RATE_LIMIT_LLM_PER_HOUR ?? "80", 10);
}

export function getRateLimitTtsPerHour(): number {
  return parseInt(process.env.RATE_LIMIT_TTS_PER_HOUR ?? "200", 10);
}

export function getQwenTtsUrl(): string | null {
  const url = process.env.QWEN_TTS_URL?.trim();
  return url || null;
}

export function getQwenTtsApiKey(): string | null {
  const key = process.env.QWEN_TTS_API_KEY?.trim();
  return key || null;
}

/** RunPod API key — required for Serverless Load Balancer gateway auth. */
export function getRunPodApiKey(): string | null {
  const key = process.env.RUNPOD_API_KEY?.trim();
  return key || null;
}

export function isRunPodServerlessQwenUrl(url: string): boolean {
  return /\.api\.runpod\.ai\/?$/i.test(url.replace(/\/$/, "")) ||
    url.includes(".api.runpod.ai");
}

export function isServerQwenTtsConfigured(): boolean {
  return Boolean(getQwenTtsUrl());
}

export { isServerQwenCloudTtsConfigured };

export function isServerElevenLabsConfigured(): boolean {
  return Boolean(getElevenLabsApiKey());
}

export function isServerTtsConfigured(): boolean {
  return (
    isServerElevenLabsConfigured() ||
    isServerOpenRouterTtsConfigured() ||
    isServerFishAudioTtsConfigured() ||
    isServerQwenTtsConfigured() ||
    isServerQwenCloudTtsConfigured()
  );
}

export function isServerLlmConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}
