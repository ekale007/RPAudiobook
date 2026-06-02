"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElevenVoiceCatalogEntry } from "@/lib/tts/elevenLabsVoices";
import {
  clearElevenLabsVoiceCatalogCache,
  elevenVoiceOptionLabel,
  loadElevenLabsVoiceCatalogDetailed,
} from "@/lib/tts/elevenLabsCatalogClient";
import { fetchElevenLabsPreview } from "@/lib/tts/elevenLabsPreview";
import { isValidElevenLabsVoiceId } from "@/lib/tts/elevenLabsVoices";

export function ElevenLabsVoiceSelect({
  value,
  onChange,
  disabled = false,
  label,
  storyLocale = "de",
  allowCustom = true,
}: {
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  label?: string;
  storyLocale?: "de" | "en";
  allowCustom?: boolean;
}) {
  const [voices, setVoices] = useState<ElevenVoiceCatalogEntry[]>([]);
  const [catalogHint, setCatalogHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const autoPickedRef = useRef(false);

  useEffect(() => {
    clearElevenLabsVoiceCatalogCache();
    loadElevenLabsVoiceCatalogDetailed()
      .then((result) => {
        setCatalogHint(result.hint);
        setVoices(result.voices);
        if (!autoPickedRef.current && result.voices.length === 1) {
          const only = result.voices[0]!.id;
          if (!value || !result.voices.some((v) => v.id === value)) {
            onChange(only);
          }
          autoPickedRef.current = true;
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load catalog once per mount
  }, []);

  useEffect(() => {
    if (
      value &&
      isValidElevenLabsVoiceId(value) &&
      !voices.some((v) => v.id === value) &&
      !customIds.includes(value)
    ) {
      setCustomIds((prev) => (prev.includes(value) ? prev : [...prev, value]));
    }
  }, [value, voices, customIds]);

  const catalogIds = useMemo(() => new Set(voices.map((v) => v.id)), [voices]);

  const allOptions = useMemo(() => {
    const extra = customIds
      .filter((id) => !catalogIds.has(id))
      .map((id) => ({
        id,
        label: "Eigene ID",
        hint: id.slice(0, 14) + (id.length > 14 ? "…" : ""),
        gender: "male" as const,
        previewUrl: null,
      }));
    return [...voices, ...extra];
  }, [voices, customIds, catalogIds]);

  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewing(false);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const previewUrlFor = (voiceId: string) =>
    allOptions.find((v) => v.id === voiceId)?.previewUrl ?? null;

  const playPreview = async (voiceId: string) => {
    if (disabled || !voiceId.trim()) return;
    stopPreview();
    setError(null);
    setPreviewing(true);
    try {
      const previewUrl = previewUrlFor(voiceId);
      if (previewUrl) {
        const audio = new Audio(previewUrl);
        audioRef.current = audio;
        audio.onended = () => stopPreview();
        audio.onerror = () => {
          stopPreview();
          setError("Vorschau-URL konnte nicht abgespielt werden.");
        };
        await audio.play();
        return;
      }

      const blob = await fetchElevenLabsPreview(voiceId, storyLocale);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
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

  const addCustomVoice = () => {
    const id = customDraft.trim();
    if (!id || id.length < 8) {
      setError("Voice-ID zu kurz (min. 8 Zeichen).");
      return;
    }
    setError(null);
    setCustomIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onChange(id);
    setCustomDraft("");
    setShowCustomInput(false);
  };

  const known = allOptions.some((v) => v.id === value);

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      {label ? (
        <label className="mb-1 block text-[10px] text-zinc-500">{label}</label>
      ) : null}
      {catalogHint && !loading ? (
        <p className="mb-1 text-[10px] leading-snug text-zinc-500">{catalogHint}</p>
      ) : null}
      {!known && value && !loading ? (
        <p className="mb-1 text-[10px] text-amber-200/90">
          Diese ID ist nicht in deinem ElevenLabs-Konto — bitte eine Stimme aus
          der Liste wählen.
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
            <option value={value}>Lade My Voices…</option>
          ) : allOptions.length === 0 ? (
            <option value="">Keine Stimmen in My Voices</option>
          ) : (
            allOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {"hint" in v && v.label === "Eigene ID"
                  ? `Eigene: ${v.hint}`
                  : elevenVoiceOptionLabel(v as ElevenVoiceCatalogEntry)}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={disabled || loading || previewing || !value.trim()}
          onClick={() => playPreview(value)}
          className="shrink-0 rounded-lg border border-surface-border px-2 py-1.5 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent disabled:opacity-40"
          title="Stimme anhören (ElevenLabs-Vorschau oder Kurz-Sample)"
        >
          {previewing ? "…" : "▶"}
        </button>
      </div>

      {allowCustom ? (
        showCustomInput ? (
          <div className="mt-1.5 flex gap-1">
            <input
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              placeholder="ElevenLabs Voice-ID"
              className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={addCustomVoice}
              className="shrink-0 rounded-lg bg-accent/20 px-2 py-1 text-xs text-accent"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomInput(false);
                setCustomDraft("");
              }}
              className="shrink-0 rounded-lg border border-surface-border px-2 py-1 text-xs text-zinc-500"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowCustomInput(true)}
            className="mt-1.5 text-[10px] text-accent underline disabled:opacity-40"
          >
            + Eigene Voice-ID hinzufügen
          </button>
        )
      ) : null}

      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
