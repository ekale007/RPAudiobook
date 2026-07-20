/**
 * Server-side TTS audio cache backed by Supabase Storage.
 *
 * Content-addressed: identical (provider, voice, text) triples produce
 * the same storage path, so a simple HEAD check before the TTS API call
 * saves both money and latency. Cache entries have no TTL — they're
 * valid as long as the upstream TTS model voice stays the same.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "tts-audio";
const CACHE_PREFIX = "cached";

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function cachePath(provider: string, voice: string, text: string): string {
  // Normalise: strip extra whitespace, lower-case for dedup.
  const norm = text.trim().replace(/\s+/g, " ");
  const voiceId = voice.trim().slice(0, 80);
  return `${CACHE_PREFIX}/${provider}/${hash(voiceId)}/${hash(norm)}.mp3`;
}

export async function getCachedTtsAudio(
  supabaseUrl: string,
  serviceRoleKey: string,
  provider: string,
  voice: string,
  text: string,
): Promise<ArrayBuffer | null> {
  const path = cachePath(provider, voice, text);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(path);
    if (error || !data) return null;
    return data.arrayBuffer();
  } catch {
    return null;
  }
}

export async function putCachedTtsAudio(
  supabaseUrl: string,
  serviceRoleKey: string,
  provider: string,
  voice: string,
  text: string,
  audio: ArrayBuffer,
): Promise<void> {
  const path = cachePath(provider, voice, text);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  try {
    await supabase.storage
      .from(BUCKET)
      .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  } catch (e) {
    // Best-effort: cache write failures are invisible to the user.
    console.warn("tts-cache: upload failed", (e as Error)?.message);
  }
}

/** Build a cache key for logging/tracing (don't use as storage path). */
export function ttsCacheDebugKey(
  provider: string,
  voice: string,
  text: string,
): string {
  return `tts:${provider}:${voice.slice(0, 20)}:${hash(text.trim())}`;
}
