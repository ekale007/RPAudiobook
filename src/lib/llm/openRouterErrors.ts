/** Parse OpenRouter / proxy error bodies into a short user-facing message. */
export function extractOpenRouterErrorMessage(raw: unknown): string {
  if (raw == null) return "Unbekannter LLM-Fehler";

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return "Unbekannter LLM-Fehler";
    try {
      return extractOpenRouterErrorMessage(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }

  if (typeof raw !== "object") return String(raw);

  const obj = raw as Record<string, unknown>;

  if (typeof obj.error === "string") {
    return extractOpenRouterErrorMessage(obj.error);
  }

  if (obj.error && typeof obj.error === "object") {
    const nested = obj.error as { message?: unknown; code?: unknown };
    if (typeof nested.message === "string") return nested.message;
  }

  if (typeof obj.message === "string") return obj.message;

  return JSON.stringify(raw);
}

export function isOpenRouterPrivacyError(message: string): boolean {
  return /guardrail|data policy|privacy|no endpoints available/i.test(message);
}

export function formatOpenRouterErrorMessage(
  message: string,
  status?: number,
): string {
  if (isOpenRouterPrivacyError(message)) {
    return (
      "OpenRouter blockiert das gewählte Modell wegen deiner Datenschutz-Einstellungen. " +
      "In Settings ein anderes Modell wählen (gleiches wie Chat/Erzähler-Modell) oder unter " +
      "openrouter.ai/settings/privacy die Data Policy lockern."
    );
  }

  if (status === 404 && /no endpoints available/i.test(message)) {
    return (
      `Modell nicht verfügbar (404): ${message}. ` +
      "Prüfe Modellname in Settings und OpenRouter Privacy-Einstellungen."
    );
  }

  return message;
}
