import { createClient } from "@/lib/supabase/client";

const BUCKET = "story-covers";
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadStoryCover(
  userId: string,
  storyId: string,
  file: Blob,
): Promise<string | null> {
  if (file.size > MAX_BYTES) {
    throw new Error("Cover darf maximal 5 MB groß sein.");
  }
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const supabase = createClient();
  const path = `${userId}/${storyId}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });

  if (error) {
    console.warn("Cover upload failed:", error.message);
    return null;
  }
  return path;
}

export async function getStoryCoverSignedUrl(
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

export async function setStoryCoverPath(
  storyId: string,
  storagePath: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("stories")
    .update({
      cover_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storyId);
  if (error) throw error;
}
