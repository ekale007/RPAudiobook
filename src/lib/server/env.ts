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

export function isServerQwenTtsConfigured(): boolean {
  return Boolean(getQwenTtsUrl());
}

export { isServerQwenCloudTtsConfigured };

export function isServerTtsConfigured(): boolean {
  return (
    Boolean(getElevenLabsApiKey()) ||
    isServerQwenTtsConfigured() ||
    isServerQwenCloudTtsConfigured()
  );
}

export function isServerLlmConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}
