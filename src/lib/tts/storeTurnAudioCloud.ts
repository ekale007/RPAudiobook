import { authFetch } from "@/lib/supabase/authFetch";

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

/** Upload MP3 for a turn via server (quota + ownership enforced). */
export async function storeTurnAudioToCloud(
  turnId: string,
  blob: Blob,
): Promise<StoreTurnAudioResult> {
  const form = new FormData();
  form.append("turnId", turnId);
  form.append("audio", blob, `${turnId}.mp3`);

  const res = await authFetch("/api/tts/store", {
    method: "POST",
    body: form,
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

  return {
    ok: true,
    path: body.path,
    used: body.used,
    max: body.max,
  };
}
