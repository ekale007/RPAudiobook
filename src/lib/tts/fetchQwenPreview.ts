import { authFetch } from "@/lib/supabase/authFetch";
import {
  isServerQwenCloudTtsAvailable,
  isServerQwenTtsAvailable,
} from "@/lib/server/serverCapabilities";

export type QwenPreviewOptions = {
  voice: string;
  text: string;
  language?: string;
  instruct?: string | null;
  /** Local Qwen server, e.g. http://127.0.0.1:5125 */
  serverUrl?: string;
  /** Prefer /api/tts/qwen when configured */
  preferServerProxy?: boolean;
  /** Use Qwen Cloud (DashScope) instead of RunPod/local proxy */
  useQwenCloud?: boolean;
};

export async function fetchQwenPreview(opts: QwenPreviewOptions): Promise<Blob> {
  const language = opts.language?.trim() || "Auto";
  const body = {
    text: opts.text,
    voice: opts.voice,
    language,
    instruct: opts.instruct?.trim() || null,
  };

  const useCloud =
    opts.useQwenCloud === true && isServerQwenCloudTtsAvailable();
  const useProxy =
    !useCloud &&
    opts.preferServerProxy !== false &&
    isServerQwenTtsAvailable();

  if (useCloud) {
    const res = await authFetch("/api/tts/qwen-cloud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error((await res.text()) || `Preview failed (${res.status})`);
    }
    return res.blob();
  }

  if (useProxy) {
    const res = await authFetch("/api/tts/qwen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error((await res.text()) || `Preview failed (${res.status})`);
    }
    return res.blob();
  }

  const base = (opts.serverUrl ?? "http://127.0.0.1:5125").replace(/\/$/, "");
  const res = await fetch("/api/tts/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, serverUrl: base }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Preview failed (${res.status})`);
  }
  return res.blob();
}
