"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLocalTtsPreview } from "@/lib/tts/localTtsPreview";
import { KOKORO_PREVIEW_TEXT, KOKORO_VOICES } from "@/lib/tts/kokoroVoices";

export function KokoroVoicePicker({
  serverUrl,
  value,
  onChange,
}: {
  serverUrl: string;
  value: string;
  onChange: (voiceId: string) => void;
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
  }, [serverUrl]);

  const playPreview = async (voiceId: string) => {
    cleanup();
    setError(null);
    setPreviewing(voiceId);
    try {
      const blob = await fetchLocalTtsPreview(
        serverUrl,
        voiceId,
        KOKORO_PREVIEW_TEXT,
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
        setError("Could not play preview");
        cleanup();
      };
      await audio.play();
    } catch (e) {
      setPreviewing(null);
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  };

  return (
    <div className="mb-3">
      <label className="mb-2 block text-xs text-zinc-400">Kokoro voice</label>
      {serverOk === false ? (
        <p className="mb-2 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Kokoro server not reachable at{" "}
          <code className="text-amber-100">{serverUrl}</code>. Start{" "}
          <code className="text-accent">npm run tts:kokoro</code> to preview.
        </p>
      ) : null}
      <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-lg border border-surface-border bg-surface p-1.5">
        {KOKORO_VOICES.map((v) => {
          const selected = value === v.id;
          return (
            <li key={v.id}>
              <div
                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                  selected ? "bg-accent/15 ring-1 ring-accent/40" : "hover:bg-white/5"
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
                    {v.id} · {v.hint}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={previewing !== null && previewing !== v.id}
                  onClick={() => playPreview(v.id)}
                  className="shrink-0 rounded-lg border border-surface-border px-2.5 py-1.5 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent disabled:opacity-40"
                  title="Preview"
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
        Tap a name to select, ▶ to hear a short sample. Save below when done.
      </p>
    </div>
  );
}
