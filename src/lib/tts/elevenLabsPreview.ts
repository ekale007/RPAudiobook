import { authFetch } from "@/lib/supabase/authFetch";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";
import { ELEVEN_DEFAULT_MODEL } from "@/lib/tts/elevenLabsVoices";
import { isServerElevenLabsAvailable } from "@/lib/server/serverCapabilities";

const PREVIEW_DE = "Hallo. So klingt diese Stimme in deiner Geschichte.";
const PREVIEW_EN = "Hello. This is how this voice will sound in your story.";

/** Short ElevenLabs sample via /api/tts (uses credits; works for any voice ID). */
export async function fetchElevenLabsPreview(
  voiceId: string,
  locale: "de" | "en" = "de",
): Promise<Blob> {
  const settings = loadTtsSettings();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!isServerElevenLabsAvailable() && settings.elevenLabsApiKey?.trim()) {
    headers["xi-api-key"] = settings.elevenLabsApiKey.trim();
  }

  const res = await authFetch("/api/tts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: locale === "de" ? PREVIEW_DE : PREVIEW_EN,
      voiceId,
      speakerSlug: "narrator",
      modelId: settings.elevenLabsModelId || ELEVEN_DEFAULT_MODEL,
      locale,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      err ||
        "Vorschau fehlgeschlagen — ElevenLabs-Key in Settings oder ELEVENLABS_API_KEY nötig.",
    );
  }

  return res.blob();
}
