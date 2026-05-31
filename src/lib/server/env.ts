/** Server-only secrets and defaults (never import from client components). */

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
    process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4"
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

export function isServerTtsConfigured(): boolean {
  return Boolean(getElevenLabsApiKey());
}

export function isServerLlmConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}
