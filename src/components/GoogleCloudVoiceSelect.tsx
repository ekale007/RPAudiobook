"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";

export type GoogleCloudVoice = {
  name: string;
  languageCodes: string[];
  gender: string;
};

type Cache = { voices: GoogleCloudVoice[]; loadedAt: number } | null;
let voiceCache: Cache = null;

/** Shared hook: fetches Google Cloud voices once per session (cached). */
export function useGoogleCloudVoices(active: boolean): {
  voices: GoogleCloudVoice[];
  loading: boolean;
} {
  const [voices, setVoices] = useState<GoogleCloudVoice[]>(voiceCache?.voices ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (voiceCache && Date.now() - voiceCache.loadedAt < 10 * 60 * 1000) {
      setVoices(voiceCache.voices);
      return;
    }
    let cancelled = false;
    setLoading(true);
    authFetch("/api/tts/google")
      .then((r) => r.json() as Promise<{ voices?: GoogleCloudVoice[] }>)
      .then((d) => {
        if (cancelled) return;
        const list = d.voices ?? [];
        voiceCache = { voices: list, loadedAt: Date.now() };
        setVoices(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { voices, loading };
}

/**
 * Voice dropdown for Google Cloud TTS. Falls back to a text input while
 * the voice list is loading or when the API returns nothing.
 */
export function GoogleCloudVoiceSelect({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (voiceName: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { voices, loading } = useGoogleCloudVoices(true);

  if (voices.length === 0) {
    return (
      <div>
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={
            className ??
            "w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50"
          }
          placeholder="de-DE-Wavenet-C"
        />
        {loading ? (
          <p className="mt-0.5 text-[10px] text-zinc-600">Lade Stimmen…</p>
        ) : null}
      </div>
    );
  }

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50"
      }
    >
      {!voices.some((v) => v.name === value) ? (
        <option value={value}>{value} (aktuell)</option>
      ) : null}
      {voices.map((v) => (
        <option key={v.name} value={v.name}>
          {v.name} — {v.languageCodes.join(", ")} ({v.gender.toLowerCase()})
        </option>
      ))}
    </select>
  );
}
