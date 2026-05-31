"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";
import {
  elevenVoiceOptionLabel,
  loadElevenLabsVoiceCatalog,
} from "@/lib/tts/elevenLabsCatalogClient";

export function ElevenLabsVoiceSelect({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [voices, setVoices] = useState<ElevenVoiceCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadElevenLabsVoiceCatalog()
      .then(setVoices)
      .finally(() => setLoading(false));
  }, []);

  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewing(false);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const previewUrlFor = (voiceId: string) =>
    voices.find((v) => v.id === voiceId)?.previewUrl ?? null;

  const playPreview = async (voiceId: string) => {
    if (disabled) return;
    const url = previewUrlFor(voiceId);
    if (!url) {
      setError("Keine ElevenLabs-Vorschau für diese Stimme.");
      return;
    }
    stopPreview();
    setError(null);
    setPreviewing(true);
    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stopPreview();
      audio.onerror = () => {
        stopPreview();
        setError("Vorschau konnte nicht abgespielt werden.");
      };
      await audio.play();
    } catch (e) {
      stopPreview();
      setError(e instanceof Error ? e.message : "Vorschau fehlgeschlagen");
    }
  };

  const known = voices.some((v) => v.id === value);

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      {label ? (
        <label className="mb-1 block text-[10px] text-zinc-500">{label}</label>
      ) : null}
      {!known && value && !loading ? (
        <p className="mb-1 text-[10px] text-zinc-600">
          Gespeichert:{" "}
          <code className="text-zinc-400">{value.slice(0, 12)}…</code>
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <select
          value={value}
          disabled={disabled || loading}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs disabled:cursor-not-allowed"
        >
          {loading ? (
            <option value={value}>Lade Stimmen…</option>
          ) : (
            voices.map((v) => (
              <option key={v.id} value={v.id}>
                {elevenVoiceOptionLabel(v)}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={disabled || loading || previewing || !previewUrlFor(value)}
          onClick={() => playPreview(value)}
          className="shrink-0 rounded-lg border border-surface-border px-2 py-1.5 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent disabled:opacity-40"
          title="ElevenLabs-Standardvorschau (kostenlos)"
        >
          {previewing ? "…" : "▶"}
        </button>
      </div>
      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
