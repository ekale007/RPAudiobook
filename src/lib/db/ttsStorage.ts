import { createClient } from "@/lib/supabase/client";

export async function uploadTurnAudio(
  userId: string,
  turnId: string,
  blob: Blob,
): Promise<string | null> {
  const supabase = createClient();
  const path = `${userId}/${turnId}.mp3`;

  const { error } = await supabase.storage
    .from("tts-audio")
    .upload(path, blob, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    console.warn("TTS cloud upload skipped:", error.message);
    return null;
  }

  return path;
}

export async function downloadTurnAudio(
  storagePath: string,
): Promise<Blob | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("tts-audio")
    .download(storagePath);
  if (error || !data) return null;
  return data;
}

export async function setTurnAudioPath(
  turnId: string,
  storagePath: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("turns")
    .update({ audio_storage_path: storagePath })
    .eq("id", turnId);
  if (error) throw error;
}
