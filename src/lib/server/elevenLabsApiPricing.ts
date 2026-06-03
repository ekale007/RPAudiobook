/**
 * Eleven API list prices (USD per 1k characters).
 * @see https://elevenlabs.io/pricing/api
 *
 * Starter ($5/mo): 30k credits/month — API calls consume credits; these USD
 * rates match the public API price list for cost estimates in the usage log.
 */

export const ELEVEN_API_USD_PER_1K_FLASH = 0.05;
export const ELEVEN_API_USD_PER_1K_STANDARD = 0.1;

export type ElevenTtsPriceTier = "flash" | "standard";

/** Flash/Turbo vs Multilingual v2/v3 (and eleven_v3). */
export function elevenTtsPriceTier(modelId: string | undefined): ElevenTtsPriceTier {
  const id = (modelId ?? "").toLowerCase();
  if (id.includes("flash") || id.includes("turbo")) return "flash";
  return "standard";
}

export function defaultElevenUsdPer1k(tier: ElevenTtsPriceTier): number {
  return tier === "flash"
    ? ELEVEN_API_USD_PER_1K_FLASH
    : ELEVEN_API_USD_PER_1K_STANDARD;
}
