/** Readable message for Supabase/PostgREST errors and other thrown values. */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
    if (typeof record.details === "string" && record.details.trim()) {
      return record.details;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unbekannter Fehler";
    }
  }
  return String(error);
}
