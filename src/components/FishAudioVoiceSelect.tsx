"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearFishAudioVoiceCatalogCache,
  fishVoiceGroupLabel,
  fishVoiceOptionLabel,
  loadFishAudioVoiceCatalogDetailed,
  type FishVoiceCatalogEntry,
} from "@/lib/tts/fishAudioCatalogClient";
import { authFetch } from "@/lib/supabase/authFetch";

export function FishAudioVoiceSelect({
  value,
  onChange,
  disabled = false,
  label,
  allowCustom = true,
  fishModel = "s2-pro",
  pinnedIds = [],
  onPinnedIdsChange,
}: {
  value: string;
  onChange: (referenceId: string) => void;
  disabled?: boolean;
  label?: string;
  allowCustom?: boolean;
  fishModel?: string;
  pinnedIds?: string[];
  onPinnedIdsChange?: (ids: string[]) => void;
}) {
  const [voices, setVoices] = useState<FishVoiceCatalogEntry[]>([]);
  const [catalogHint, setCatalogHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const autoPickedRef = useRef(false);

  const pinned = useMemo(
    () => pinnedIds.map((id) => id.trim()).filter((id) => id.length >= 8),
    [pinnedIds],
  );

  useEffect(() => {
    clearFishAudioVoiceCatalogCache();
    setLoading(true);
    loadFishAudioVoiceCatalogDetailed(pinned)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when pinned list changes
  }, [pinned.join(",")]);

  const catalogIds = useMemo(() => new Set(voices.map((v) => v.id)), [voices]);

  const groups = useMemo(() => {
    const order: Array<NonNullable<FishVoiceCatalogEntry["source"]>> = [
      "pinned",
      "bookmark",
      "self",
    ];
    const bySource = new Map<string, FishVoiceCatalogEntry[]>();
    for (const v of voices) {
      const key = v.source ?? "self";
      const list = bySource.get(key) ?? [];
      list.push(v);
      bySource.set(key, list);
    }
    return order
      .filter((src) => bySource.has(src))
      .map((src) => ({
        source: src,
        label: fishVoiceGroupLabel(src),
        voices: bySource.get(src)!,
      }));
  }, [voices]);

  const currentEntry = voices.find((v) => v.id === value);
  const canRemovePinned =
    currentEntry?.source === "pinned" && onPinnedIdsChange && value.trim();

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

  const playPreview = async (referenceId: string) => {
    if (disabled || !referenceId.trim()) return;
    stopPreview();
    setError(null);
    setPreviewing(true);
    try {
      const res = await authFetch("/api/tts/fish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hallo, das ist eine kurze Stimm-Vorschau.",
          referenceId,
          model: fishModel,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let message = raw || `Vorschau fehlgeschlagen (${res.status})`;
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed.error?.trim()) message = parsed.error.trim();
        } catch {
          /* plain */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
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

  const addPinnedId = (id: string) => {
    if (!onPinnedIdsChange) return;
    const trimmed = id.trim();
    if (trimmed.length < 8) {
      setError("reference_id mindestens 8 Zeichen.");
      return;
    }
    setError(null);
    if (!pinned.includes(trimmed)) {
      onPinnedIdsChange([...pinned, trimmed]);
    }
    onChange(trimmed);
    setCustomDraft("");
    setShowCustomInput(false);
  };

  const removePinnedId = (id: string) => {
    if (!onPinnedIdsChange) return;
    onPinnedIdsChange(pinned.filter((p) => p !== id));
    if (value === id) {
      const fallback = voices.find((v) => v.id !== id)?.id ?? "";
      if (fallback) onChange(fallback);
    }
  };

  const known = catalogIds.has(value);

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      {label ? (
        <label className="mb-1 block text-[10px] text-zinc-500">{label}</label>
      ) : null}
      {catalogHint && !loading ? (
        <p className="mb-1 text-[10px] leading-snug text-zinc-500">
          {catalogHint} ·{" "}
          <a
            href="https://fish.audio/de/app/bookmarks/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            Lesezeichen verwalten
          </a>
        </p>
      ) : null}
      {!known && value && !loading ? (
        <p className="mb-1 text-[10px] text-amber-200/90">
          ID nicht in der Liste — unten speichern oder auf fish.audio bookmarken.
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
            <option value={value}>Lade Fish-Stimmen…</option>
          ) : groups.length === 0 ? (
            <option value={value || ""}>
              {value ? `ID: ${value.slice(0, 12)}…` : "Keine Stimmen geladen"}
            </option>
          ) : (
            groups.map((g) => (
              <optgroup key={g.source ?? g.label} label={g.label}>
                {g.voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {fishVoiceOptionLabel(v)}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={disabled || loading || previewing || !value.trim()}
          onClick={() => playPreview(value)}
          className="shrink-0 rounded-lg border border-surface-border px-2 py-1.5 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent disabled:opacity-40"
          title="Kurz-Vorschau (verbraucht Fish-Guthaben)"
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
              placeholder="Fish reference_id"
              className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => addPinnedId(customDraft)}
              className="shrink-0 rounded-lg bg-accent/20 px-2 py-1 text-xs text-accent"
            >
              Speichern
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
            + ID aus Lesezeichen speichern
          </button>
        )
      ) : null}

      {canRemovePinned ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => removePinnedId(value)}
          className="mt-1 text-[10px] text-zinc-500 underline disabled:opacity-40"
        >
          Gespeicherte ID entfernen
        </button>
      ) : null}

      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
