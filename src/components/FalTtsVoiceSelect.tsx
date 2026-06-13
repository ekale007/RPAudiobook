"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";
import { FAL_PREVIEW_TEXT } from "@/lib/tts/falTtsVoices";
import {
  falTtsModelMeta,
  falTtsVoiceGroups,
  normalizeFalTtsVoice,
} from "@/lib/tts/falTtsModels";

export function FalTtsVoiceSelect({
  model,
  value,
  onChange,
  disabled = false,
  label,
  allowCustom = true,
}: {
  model: string;
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  label?: string;
  allowCustom?: boolean;
}) {
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const groups = useMemo(() => falTtsVoiceGroups(model), [model]);
  const catalogIds = useMemo(
    () => new Set(groups.flatMap((g) => g.voices.map((v) => v.id))),
    [groups],
  );

  useEffect(() => {
    const trimmed = value?.trim();
    if (
      trimmed &&
      trimmed.length >= 2 &&
      !catalogIds.has(trimmed) &&
      !customIds.includes(trimmed)
    ) {
      setCustomIds((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    }
  }, [value, catalogIds, customIds]);

  const resolvedValue = normalizeFalTtsVoice(model, value);
  const known =
    catalogIds.has(resolvedValue) || customIds.includes(resolvedValue);

  const addCustomVoice = () => {
    const id = customDraft.trim();
    if (!id || id.length < 2) {
      setError("Voice-ID mindestens 2 Zeichen.");
      return;
    }
    setError(null);
    setCustomIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onChange(id);
    setCustomDraft("");
    setShowCustomInput(false);
  };

  const previewVoice = useCallback(async () => {
    if (disabled || previewing) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await authFetch("/api/tts/fal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: FAL_PREVIEW_TEXT,
          model,
          voice: resolvedValue,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let message = raw || `Preview failed (${res.status})`;
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed.error?.trim()) message = parsed.error.trim();
        } catch {
          /* plain */
        }
        setError(message);
        return;
      }
      const blob = await res.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = url;
      await audioRef.current.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewing(false);
    }
  }, [disabled, previewing, model, resolvedValue]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const voiceCount = groups.reduce((n, g) => n + g.voices.length, 0);

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      {label ? (
        <label className="mb-1 block text-[10px] text-zinc-500">{label}</label>
      ) : null}
      <p className="mb-1 text-[10px] leading-snug text-zinc-500">
        {falTtsModelMeta(model).label} — {voiceCount} Preset-Stimmen
      </p>
      {!known && value?.trim() && !catalogIds.has(value) ? (
        <p className="mb-1 text-[10px] text-amber-200/90">
          Eigene ID — prüfen, ob sie zum gewählten Modell passt.
        </p>
      ) : null}
      <div className="flex gap-2">
        <select
          value={resolvedValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
        >
          {groups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.hint ? ` (${v.hint})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
          {customIds
            .filter((id) => !catalogIds.has(id))
            .map((id) => (
              <option key={id} value={id}>
                Eigene: {id}
              </option>
            ))}
        </select>
        <button
          type="button"
          disabled={disabled || previewing}
          onClick={() => void previewVoice()}
          className="shrink-0 rounded-lg border border-surface-border px-2 py-1.5 text-[10px] text-zinc-300 disabled:opacity-40"
        >
          {previewing ? "…" : "▶"}
        </button>
      </div>
      {allowCustom ? (
        <div className="mt-2">
          {showCustomInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder="Voice-ID"
                className="min-w-0 flex-1 rounded border border-surface-border bg-surface px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={addCustomVoice}
                className="rounded border border-surface-border px-2 text-[10px] text-zinc-300"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowCustomInput(true)}
              className="text-[10px] text-zinc-500 underline disabled:opacity-40"
            >
              Eigene Voice-ID
            </button>
          )}
        </div>
      ) : null}
      {error ? (
        <p className="mt-1 text-[10px] text-red-300/90">{error}</p>
      ) : null}
    </div>
  );
}
