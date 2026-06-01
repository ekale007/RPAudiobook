"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchQwenPreview } from "@/lib/tts/fetchQwenPreview";
import {
  instructPresetsForSlug,
  previewTextForLocale,
} from "@/lib/tts/qwenInstructPresets";
import { QWEN_VOICES } from "@/lib/tts/qwenVoices";
import type { QwenVoiceProfile } from "@/lib/types";
import { LOCAL_TTS_PRESETS } from "@/lib/storage/ttsPresets";
import { isServerQwenCloudTtsAvailable } from "@/lib/server/serverCapabilities";
import { loadTtsSettings } from "@/lib/storage/ttsSettings";

const LANGUAGES = [
  { id: "Auto", label: "Auto" },
  { id: "German", label: "Deutsch" },
  { id: "English", label: "English" },
] as const;

export function QwenVoiceEditor({
  profile,
  onChange,
  locale = "de",
  disabled = false,
  compact = false,
}: {
  profile: QwenVoiceProfile;
  onChange: (next: QwenVoiceProfile) => void;
  locale?: "de" | "en";
  disabled?: boolean;
  compact?: boolean;
}) {
  const [previewText, setPreviewText] = useState(() =>
    previewTextForLocale(locale),
  );
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const tts = loadTtsSettings();
  const useQwenCloud = tts.provider === "qwen-cloud";
  const serverUrl =
    tts.localServerUrl.trim() || LOCAL_TTS_PRESETS.qwen.serverUrl;

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
    setPreviewText(previewTextForLocale(locale));
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    if (useQwenCloud) {
      fetch("/api/health", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled) {
            setServerOk(
              Boolean(j?.serverQwenCloudTts) || isServerQwenCloudTtsAvailable(),
            );
          }
        })
        .catch(() => {
          if (!cancelled) setServerOk(false);
        });
      return () => {
        cancelled = true;
      };
    }
    const base = serverUrl.replace(/\/$/, "");
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
  }, [serverUrl, useQwenCloud]);

  const patch = (partial: Partial<QwenVoiceProfile>) => {
    onChange({
      ...profile,
      ...partial,
      slug: profile.slug,
      mode: "preset",
      updatedAt: new Date().toISOString(),
    });
  };

  const playPreview = async () => {
    cleanup();
    setError(null);
    setPreviewing(true);
    try {
      const blob = await fetchQwenPreview({
        voice: profile.presetSpeaker ?? "Ryan",
        text: previewText.trim() || previewTextForLocale(locale),
        language: profile.language ?? (locale === "de" ? "German" : "Auto"),
        instruct: profile.designInstruct?.trim() || null,
        serverUrl,
        useQwenCloud,
        preferServerProxy: !useQwenCloud,
      });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPreviewing(false);
        cleanup();
      };
      audio.onerror = () => {
        setPreviewing(false);
        setError("Wiedergabe fehlgeschlagen");
        cleanup();
      };
      await audio.play();
    } catch (e) {
      setPreviewing(false);
      setError(e instanceof Error ? e.message : "Vorschau fehlgeschlagen");
    }
  };

  const instructPresets = instructPresetsForSlug(profile.slug);
  const presetGroups = ["narrator", "scene", "emotion", "dialogue"] as const;

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      {serverOk === false ? (
        <p className="mb-2 rounded border border-amber-900/50 bg-amber-950/30 px-2 py-1.5 text-[10px] text-amber-200">
          {useQwenCloud
            ? "Qwen Cloud nicht aktiv — DASHSCOPE_API_KEY auf dem Server setzen."
            : (
              <>
                Qwen offline —{" "}
                <code className="text-accent">npm run tts:qwen</code>
              </>
            )}
        </p>
      ) : null}

      <label className="mb-1 block text-[10px] text-zinc-500">Preset-Stimme</label>
      <select
        value={profile.presetSpeaker ?? "Ryan"}
        onChange={(e) => patch({ presetSpeaker: e.target.value })}
        className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
      >
        {QWEN_VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label} — {v.hint}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[10px] text-zinc-500">Sprache</label>
      <select
        value={profile.language ?? "Auto"}
        onChange={(e) => patch({ language: e.target.value })}
        className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[10px] text-zinc-500">
        Stil (instruct) — optional
      </label>
      <div className="mb-2 space-y-2">
        {presetGroups.map((group) => {
          const items = instructPresets.filter((p) => p.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="mb-1 text-[9px] uppercase tracking-wide text-zinc-600">
                {group === "narrator"
                  ? "Erzählung"
                  : group === "scene"
                    ? "Szene"
                    : group === "emotion"
                      ? "Gefühl"
                      : "Dialog"}
              </p>
              <div className="flex flex-wrap gap-1">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => patch({ designInstruct: p.instruct })}
                    className={`rounded-md px-2 py-0.5 text-[10px] ${
                      profile.designInstruct?.trim() === p.instruct
                        ? "bg-accent/25 text-accent ring-1 ring-accent/40"
                        : "border border-surface-border text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <textarea
        value={profile.designInstruct ?? ""}
        onChange={(e) => patch({ designInstruct: e.target.value })}
        rows={compact ? 2 : 3}
        placeholder="z. B. Quiet, suspenseful tone, low and measured."
        className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-zinc-200"
      />

      {!compact ? (
        <>
          <label className="mb-1 block text-[10px] text-zinc-500">
            Vorschau-Text
          </label>
          <textarea
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            rows={2}
            className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs"
          />
        </>
      ) : null}

      <button
        type="button"
        disabled={previewing}
        onClick={() => void playPreview()}
        className="w-full rounded-lg border border-accent/40 bg-accent/10 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-40"
      >
        {previewing ? "Generiere…" : "▶ Stil-Vorschau"}
      </button>
      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
