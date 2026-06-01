/** Short sample via Next.js proxy to local TTS server. */
export async function fetchLocalTtsPreview(
  serverUrl: string,
  voice: string,
  text?: string,
  options?: { language?: string; instruct?: string | null },
): Promise<Blob> {
  const base = serverUrl.replace(/\/$/, "");
  const res = await fetch("/api/tts/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text ?? "Hello. I will narrate your story.",
      voice,
      serverUrl: base,
      language: options?.language,
      instruct: options?.instruct ?? null,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Preview failed (${res.status})`);
  }

  return res.blob();
}
