import {
  setTurnAudioPath,
  uploadTurnAudio,
} from "@/lib/db/ttsStorage";
import { authFetch } from "@/lib/supabase/authFetch";
import { createClient } from "@/lib/supabase/client";

export type TtsStorageQuota = {
  used: number;
  max: number;
  remaining: number;
};

export async function fetchTtsStorageQuota(): Promise<TtsStorageQuota | null> {
  const res = await authFetch("/api/tts/quota");
  if (!res.ok) return null;
  return (await res.json()) as TtsStorageQuota;
}

export type StoreTurnAudioResult = {
  ok: boolean;
  path?: string;
  used?: number;
  max?: number;
  error?: string;
};

/** Server checks quota; MP3 uploads directly to Supabase (no Vercel body limit). */
export async function storeTurnAudioToCloud(
  turnId: string,
  blob: Blob,
): Promise<StoreTurnAudioResult> {
  const res = await authFetch("/api/tts/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnId }),
  });

  let body: { error?: string; path?: string; used?: number; max?: number } = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? `Speichern fehlgeschlagen (${res.status})`,
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Bitte einloggen." };
  }

  const path = await uploadTurnAudio(user.id, turnId, blob);
  if (!path) {
    return {
      ok: false,
      error: "Upload zu Supabase fehlgeschlagen — Storage-Bucket prüfen.",
    };
  }

  try {
    await setTurnAudioPath(turnId, path);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Datenbank-Update fehlgeschlagen",
    };
  }

  return {
    ok: true,
    path: body.path ?? path,
    used: body.used,
    max: body.max,
  };
}
