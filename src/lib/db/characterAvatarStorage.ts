import { createClient } from "@/lib/supabase/client";

const BUCKET = "story-covers";
const MAX_BYTES = 5 * 1024 * 1024;

function extensionFor(file: Blob): { ext: string; contentType: string } {
  if (file.type === "image/png") {
    return { ext: "png", contentType: "image/png" };
  }
  if (file.type === "image/webp") {
    return { ext: "webp", contentType: "image/webp" };
  }
  return { ext: "jpg", contentType: file.type || "image/jpeg" };
}

export async function uploadCharacterAvatar(
  userId: string,
  storyId: string,
  characterId: string,
  file: Blob,
): Promise<string | null> {
  if (file.size > MAX_BYTES) {
    throw new Error("Foto darf maximal 5 MB groß sein.");
  }
  const { ext, contentType } = extensionFor(file);
  const supabase = createClient();
  const path = `${userId}/avatars/${storyId}/${characterId}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message || "Foto-Upload fehlgeschlagen.");
  }
  return path;
}

export async function getCharacterAvatarSignedUrl(
  storagePath: string | null | undefined,
): Promise<string | null> {
  if (!storagePath?.trim()) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
