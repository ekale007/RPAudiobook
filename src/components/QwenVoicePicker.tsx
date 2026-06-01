"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLocalTtsPreview } from "@/lib/tts/localTtsPreview";
import { QWEN_PREVIEW_TEXT, QWEN_VOICES } from "@/lib/tts/qwenVoices";
import { authFetch } from "@/lib/supabase/authFetch";

export function QwenVoicePicker({
  serverUrl,
  value,
  onChange,
  /** Use authenticated /api/tts/qwen (RunPod) instead of local server URL. */
  serverProxy = false,
  /** Use /api/tts/qwen-cloud (DashScope). */
  cloudProxy = false,
}: {
  serverUrl: string;
  value: string;
  onChange: (voiceId: string) => void;
  serverProxy?: boolean;
  cloudProxy?: boolean;
}) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (cloudProxy) {
      let cancelled = false;
      fetch("/api/health", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled) setServerOk(Boolean(j?.serverQwenCloudTts));
        })
        .catch(() => {
          if (!cancelled) setServerOk(false);
        });
      return () => {
        cancelled = true;
      };
    }
    if (serverProxy) {
      let cancelled = false;
      fetch("/api/health", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled) setServerOk(Boolean(j?.serverQwenTts));
        })
        .catch(() => {
          if (!cancelled) setServerOk(false);
        });
      return () => {
        cancelled = true;
      };
    }
    const base = serverUrl.replace(/\/$/, "");
    if (!base) {
      setServerOk(false);
      return;
    }
    let cancelled = false;
    fetch(`${base}/health`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setServerOk(Boolean(j?.ok));
      })
      .catch(() => {
        if (!cancelled) setServerOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverUrl, serverProxy, cloudProxy]);

  const playPreview = async (voiceId: string) => {
    cleanup();
    setError(null);
    setPreviewing(voiceId);
    try {
      const blob = cloudProxy
        ? await fetchQwenCloudPreview(voiceId)
        : serverProxy
          ? await fetchQwenServerPreview(voiceId)
          : await fetchLocalTtsPreview(
            serverUrl,
            voiceId,
            QWEN_PREVIEW_TEXT,
          );
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPreviewing(null);
        cleanup();
      };
      audio.onerror = () => {
        setPreviewing(null);
        setError("Vorschau konnte nicht abgespielt werden");
        cleanup();
      };
      await audio.play();
    } catch (e) {
      setPreviewing(null);
      setError(e instanceof Error ? e.message : "Vorschau fehlgeschlagen");
    }
  };

  const selected =
    QWEN_VOICES.find((v) => v.id === value)?.id ??
    QWEN_VOICES.find((v) => v.id.toLowerCase() === value.toLowerCase())?.id ??
    value;

  return (
    <div className="mb-3">
      <label className="mb-2 block text-xs text-zinc-400">Qwen-Stimme</label>
      {serverOk === false ? (
        <p className="mb-2 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          {cloudProxy
            ? "Qwen Cloud nicht konfiguriert — DASHSCOPE_API_KEY auf Vercel setzen."
            : serverProxy
            ? "Qwen RunPod nicht erreichbar. Pod starten und QWEN_TTS_URL auf Vercel setzen."
            : (
              <>
                Qwen-Server nicht erreichbar unter{" "}
                <code className="text-amber-100">{serverUrl}</code>. Starte{" "}
                <code className="text-accent">npm run tts:qwen</code> für Vorschau.
              </>
            )}
        </p>
      ) : null}
      <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-lg border border-surface-border bg-surface p-1.5">
        {QWEN_VOICES.map((v) => {
          const isSelected = selected === v.id;
          return (
            <li key={v.id}>
              <div
                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                  isSelected
                    ? "bg-accent/15 ring-1 ring-accent/40"
                    : "hover:bg-white/5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange(v.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block text-sm font-medium text-zinc-200">
                    {v.label}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {v.id} · {v.hint} · {v.language}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={previewing !== null && previewing !== v.id}
                  onClick={() => playPreview(v.id)}
                  className="shrink-0 rounded-lg border border-surface-border px-2.5 py-1.5 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent disabled:opacity-40"
                  title="Vorschau"
                >
                  {previewing === v.id ? "…" : "▶"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      ) : null}
      <p className="mt-2 text-xs text-zinc-600">
        Name antippen = wählen, ▶ = Kurzprobe. Unten speichern.
        {cloudProxy ? (
          <>
            {" "}
            Cloud: lokale Namen wie Ryan → Ethan (DashScope-Katalog).
          </>
        ) : null}
      </p>
    </div>
  );
}

async function fetchQwenCloudPreview(voiceId: string): Promise<Blob> {
  const res = await authFetch("/api/tts/qwen-cloud", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: QWEN_PREVIEW_TEXT,
      voice: voiceId,
      language: "Auto",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Preview failed (${res.status})`);
  }
  return res.blob();
}

async function fetchQwenServerPreview(voiceId: string): Promise<Blob> {
  const res = await authFetch("/api/tts/qwen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: QWEN_PREVIEW_TEXT,
      voice: voiceId,
      language: "Auto",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Preview failed (${res.status})`);
  }
  return res.blob();
}
