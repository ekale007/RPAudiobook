"use client";

import { useEffect, useMemo, useState } from "react";
import {
  normalizeOpenRouterTtsVoice,
  openRouterTtsModelMeta,
} from "@/lib/tts/openRouterTtsModels";
import { openRouterTtsVoiceGroups } from "@/lib/tts/openRouterTtsVoices";

export function OpenRouterTtsVoiceSelect({
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

  const groups = useMemo(() => openRouterTtsVoiceGroups(model), [model]);
  const catalogIds = useMemo(
    () => new Set(groups.flatMap((g) => g.voices.map((v) => v.id))),
    [groups],
  );

  useEffect(() => {
    const trimmed = value?.trim();
    if (
      trimmed &&
      trimmed.length >= 4 &&
      !catalogIds.has(trimmed) &&
      !customIds.includes(trimmed)
    ) {
      setCustomIds((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    }
  }, [value, catalogIds, customIds]);

  const resolvedValue = normalizeOpenRouterTtsVoice(model, value);
  const known =
    catalogIds.has(resolvedValue) || customIds.includes(resolvedValue);

  const addCustomVoice = () => {
    const id = customDraft.trim();
    if (!id || id.length < 4) {
      setError("Voice-ID mindestens 4 Zeichen.");
      return;
    }
    setError(null);
    setCustomIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onChange(id);
    setCustomDraft("");
    setShowCustomInput(false);
  };

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      {label ? (
        <label className="mb-1 block text-[10px] text-zinc-500">{label}</label>
      ) : null}
      <p className="mb-1 text-[10px] leading-snug text-zinc-500">
        {openRouterTtsModelMeta(model).label} —{" "}
        {groups.reduce((n, g) => n + g.voices.length, 0)} Preset-Stimmen
      </p>
      {!known && value?.trim() && !catalogIds.has(value) ? (
        <p className="mb-1 text-[10px] text-amber-200/90">
          Eigene ID — prüfen, ob sie zum gewählten Modell passt.
        </p>
      ) : null}
      <select
        value={resolvedValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs disabled:cursor-not-allowed"
      >
        {customIds
          .filter((id) => !catalogIds.has(id))
          .map((id) => (
            <option key={`custom-${id}`} value={id}>
              Eigene: {id.length > 16 ? `${id.slice(0, 14)}…` : id}
            </option>
          ))}
        {groups.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {allowCustom ? (
        showCustomInput ? (
          <div className="mt-1.5 flex gap-1">
            <input
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              placeholder="Voice-ID (z. B. af_heart)"
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
