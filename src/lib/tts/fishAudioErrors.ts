/** User-facing messages for Fish Audio upstream errors. */

export function parseFishAudioErrorBody(raw: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as {
      message?: string;
      error?: string;
      detail?: string;
    };
    return (
      parsed.message?.trim() ||
      parsed.error?.trim() ||
      parsed.detail?.trim() ||
      trimmed
    );
  } catch {
    return trimmed.slice(0, 400);
  }
}

export function formatFishAudioTtsError(
  status: number,
  rawBody?: string,
): { message: string; code?: string } {
  const detail = parseFishAudioErrorBody(rawBody ?? "");
  const lower = detail.toLowerCase();

  if (status === 402) {
    const credits =
      lower.includes("balance") ||
      lower.includes("credit") ||
      lower.includes("insufficient");
    const invalidKey = lower.includes("api key") || lower.includes("apikey");
    if (invalidKey && !credits) {
      return {
        code: "fish_auth",
        message:
          "Fish Audio: API-Key ungültig oder Wallet leer. Prüfe FISH_AUDIO_API_KEY in Vercel und lade Guthaben auf fish.audio/app/billing.",
      };
    }
    return {
      code: "fish_credits",
      message:
        "Fish Audio: Kein API-Guthaben (402). Wallet aufladen unter fish.audio/app/billing — danach TTS erneut versuchen.",
    };
  }

  if (status === 401) {
    return {
      code: "fish_auth",
      message:
        "Fish Audio: API-Key ungültig. FISH_AUDIO_API_KEY in Vercel prüfen (fish.audio → API Keys).",
    };
  }

  if (status === 400) {
    return {
      code: "fish_bad_request",
      message: detail
        ? `Fish Audio: ${detail}`
        : "Fish Audio: Ungültige Anfrage — reference_id in Settings prüfen.",
    };
  }

  if (status === 429) {
    return {
      code: "fish_rate_limit",
      message: "Fish Audio: Rate-Limit — bitte kurz warten und erneut versuchen.",
    };
  }

  if (detail) {
    return { message: `Fish Audio (${status}): ${detail}` };
  }

  return {
    message: `Fish Audio TTS fehlgeschlagen (${status}).`,
  };
}
