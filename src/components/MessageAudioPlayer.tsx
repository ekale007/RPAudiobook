"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { MessageAudioPlayerHandle } from "@/lib/tts/messageAudioPlayerHandle";
import { createClient } from "@/lib/supabase/client";
import { downloadTurnAudio } from "@/lib/db/ttsStorage";
import { storeTurnAudioToCloud } from "@/lib/tts/storeTurnAudioCloud";
import { getNarratorAudio } from "@/lib/tts/narratorTts";
import type { CharacterRow } from "@/lib/db/stories";
import type { VoiceMap, StorySettings } from "@/lib/types";
import { loadTtsSettings, ttsCacheVoiceKey } from "@/lib/storage/ttsSettings";
import { ambienceIdsFromPlot, parseSfxTags } from "@/lib/audio/sfxCatalog";
import { isPlotStateEmpty } from "@/lib/memory/plotState";
import { isStoryDeliveryEnabled } from "@/lib/tts/resolveStoryDelivery";
import {
  hasActiveAmbienceLoops,
  pauseAllSfxLoops,
  playSfxForTags,
  resumeAllSfxLoops,
  stopAllSfx,
} from "@/lib/audio/sfxPlayer";
import { isServerElevenLabsAvailable, refreshServerCapabilities } from "@/lib/server/serverCapabilities";
import {
  clampPlaybackRate,
  formatAudioTime,
  formatPlaybackRate,
  loadPlaybackRate,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_STEP,
  savePlaybackRate,
} from "@/lib/storage/ttsPlaybackSettings";
import { voiceForSpeaker } from "@/lib/tts/defaultVoiceMap";
import {
  filterSegmentOverridesForActivation,
  type VoiceEnabledSlugs,
} from "@/lib/tts/voiceActivation";
import { stripSpeakerTags } from "@/lib/chat/parseSpeakerBlocks";
import { localTtsRouteCacheSuffix } from "@/lib/tts/ttsLocaleRouting";
import { resolveSegmentOverridesForTurn } from "@/lib/chat/resolveDialogueAttribution";
import {
  buildTtsCacheKey,
  getCachedAudio,
  setCachedAudio,
} from "@/lib/storage/ttsAudioCache";
import {
  autoplayBlockedHint,
  isAutoplayBlockedError,
} from "@/lib/tts/autoplayPolicy";
import { unlockAudioForAutoplay } from "@/lib/tts/audioUnlock";
import {
  configureMobileHtmlAudio,
  getWebAudioPlaybackDuration,
  getWebAudioPlaybackPosition,
  isWebAudioTtsActive,
  pauseWebAudioPlayback,
  playBlobViaWebAudio,
  resumeWebAudioPlayback,
  seekWebAudioPlayback,
  shouldUseWebAudioForTts,
  stopActiveTtsSource,
} from "@/lib/tts/mobileAudioPlayback";
import {
  audioFilenameForTurn,
  downloadBlob,
} from "@/lib/audio/downloadBlob";
import { saveTurnAudioToDevice } from "@/lib/audio/saveTurnAudio";

type Status = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

export type { MessageAudioPlayerHandle };

export const MessageAudioPlayer = forwardRef<
  MessageAudioPlayerHandle,
  {
    turnId: string;
    text: string;
    /** Raw turn content — used to resolve dialogue voices before synthesis. */
    rawContent?: string;
    audioStoragePath?: string | null;
    onStoragePath?: (path: string) => void;
    speakerSlug?: string | null;
    voiceMap?: VoiceMap;
    segmentOverrides?: Record<string, string>;
    cast?: CharacterRow[];
    voiceEnabledSlugs?: VoiceEnabledSlugs;
    /** When true, ▶ delegates to the autoplay queue (chain + buffer). */
    autoplayChain?: boolean;
    onChainPlay?: () => void;
    onPlaybackActiveChange?: (active: boolean) => void;
    storyLocale?: string;
    storySettings?: StorySettings;
    chapterTitle?: string | null;
    onCloudQuotaChange?: () => void;
    onTtsCostCents?: (cents: number) => void;
  }
>(function MessageAudioPlayer(
  {
    turnId,
    text,
    rawContent,
    audioStoragePath,
    onStoragePath,
    speakerSlug,
    voiceMap,
    segmentOverrides,
    cast,
    voiceEnabledSlugs,
    autoplayChain,
    onChainPlay,
    onPlaybackActiveChange,
    storyLocale,
    storySettings,
    chapterTitle,
    onCloudQuotaChange,
    onTtsCostCents,
  },
  ref,
) {
  const [status, setStatus] = useState<Status>("idle");
  const [saving, setSaving] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(Boolean(audioStoragePath));
  const [error, setError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const ensurePromiseRef = useRef<Promise<HTMLAudioElement | null> | null>(
    null,
  );
  const tickRef = useRef<number | null>(null);
  const playEndRef = useRef<(() => void) | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const webAudioActiveRef = useRef(false);

  const cleanupUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stopTick = useCallback(() => {
    if (tickRef.current !== null) {
      cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const syncTimesFromAudio = useCallback(() => {
    if (webAudioActiveRef.current && isWebAudioTtsActive()) {
      const pos = getWebAudioPlaybackPosition();
      const dur = getWebAudioPlaybackDuration();
      setCurrentTime(pos);
      if (dur > 0) setDuration(dur);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
  }, []);

  const startTick = useCallback(() => {
    stopTick();
    const loop = () => {
      if (!seeking) syncTimesFromAudio();
      tickRef.current = requestAnimationFrame(loop);
    };
    tickRef.current = requestAnimationFrame(loop);
  }, [seeking, stopTick, syncTimesFromAudio]);

  useEffect(() => {
    setPlaybackRate(loadPlaybackRate());
  }, []);

  useEffect(() => {
    setCloudSaved(Boolean(audioStoragePath));
  }, [audioStoragePath]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (status === "playing") startTick();
    else stopTick();
    return stopTick;
  }, [status, startTick, stopTick]);

  useEffect(
    () => () => {
      stopTick();
      audioRef.current?.pause();
      cleanupUrl();
    },
    [cleanupUrl, stopTick],
  );

  useEffect(() => {
    const active = status === "playing" || status === "paused";
    onPlaybackActiveChange?.(active);
  }, [status, onPlaybackActiveChange]);

  useEffect(
    () => () => {
      onPlaybackActiveChange?.(false);
    },
    [onPlaybackActiveChange],
  );

  /** Drop stale blob URLs after HMR or when turn content changes. */
  useEffect(() => {
    cleanupUrl();
    audioRef.current?.pause();
    audioRef.current = null;
    ensurePromiseRef.current = null;
    setStatus("idle");
    setError(null);
    setAutoplayBlocked(false);
    setCurrentTime(0);
    setDuration(0);
    blobRef.current = null;
    webAudioActiveRef.current = false;
    stopAllSfx();
  }, [turnId, text, rawContent, cleanupUrl]);

  const attachAudio = (audio: HTMLAudioElement) => {
    configureMobileHtmlAudio(audio);
    audio.playbackRate = playbackRate;
    audio.ontimeupdate = () => {
      if (!seeking) setCurrentTime(audio.currentTime);
    };
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.onended = () => {
      stopAllSfx();
      setStatus("ready");
      setCurrentTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
      playEndRef.current?.();
      playEndRef.current = null;
    };
    audio.onerror = () => {
      setStatus("error");
      setError("Wiedergabe fehlgeschlagen");
    };
  };

  const ensureAudio = async (): Promise<HTMLAudioElement | null> => {
    if (audioRef.current && objectUrlRef.current) {
      return audioRef.current;
    }
    if (ensurePromiseRef.current) {
      return ensurePromiseRef.current;
    }

    const run = async (): Promise<HTMLAudioElement | null> => {
    const settings = loadTtsSettings();
    if (
      settings.provider === "elevenlabs" &&
      !settings.elevenLabsApiKey.trim()
    ) {
      await refreshServerCapabilities();
      if (!isServerElevenLabsAvailable()) {
        setError(
          "ElevenLabs-Key in Settings eintragen oder ELEVENLABS_API_KEY auf dem Server setzen.",
        );
        setStatus("error");
        return null;
      }
    }

    setStatus("loading");
    setError(null);

    try {
      let blob: Blob | null = null;

      let resolvedOverrides = segmentOverrides ?? {};
      if (rawContent?.trim() && cast?.length) {
        resolvedOverrides = await resolveSegmentOverridesForTurn(
          turnId,
          rawContent,
          cast,
          {
            locale: storyLocale,
            protagonist: storySettings?.protagonist,
          },
        );
      }

      const activeOverrides = filterSegmentOverridesForActivation(
        resolvedOverrides,
        voiceEnabledSlugs,
      );
      const hasSegmentOverrides = Object.entries(activeOverrides).some(
        ([snippet, slug]) =>
          snippet.trim().length > 0 && slug && slug !== "narrator",
      );

      const baseText = stripSpeakerTags(rawContent ?? text).trim() || text.trim();

      const localVoice =
        (settings.provider === "local" ||
          settings.provider === "qwen" ||
          settings.provider === "qwen-cloud") &&
        voiceMap
          ? voiceForSpeaker(
              speakerSlug,
              voiceMap,
              settings.localVoice,
              voiceEnabledSlugs,
            )
          : settings.localVoice;
      const cacheKey = buildTtsCacheKey(
        settings.provider === "local" ||
        settings.provider === "qwen" ||
        settings.provider === "qwen-cloud"
          ? `${ttsCacheVoiceKey(settings)}:${localVoice}${
              hasSegmentOverrides
                ? `:multi:${JSON.stringify(activeOverrides)}:${storyLocale?.startsWith("de") ? "de" : "en"}:${JSON.stringify(voiceEnabledSlugs ?? null)}${localTtsRouteCacheSuffix(settings, storyLocale)}`
                : localTtsRouteCacheSuffix(settings, storyLocale)
            }`
          : ttsCacheVoiceKey(settings),
        settings.provider,
        baseText,
      );
      blob = await getCachedAudio(cacheKey);

      if (!blob && audioStoragePath && !hasSegmentOverrides) {
        blob = await downloadTurnAudio(audioStoragePath);
        if (blob) await setCachedAudio(cacheKey, blob);
      }

      if (!blob) {
        const audioResult = await getNarratorAudio(settings, baseText, {
          speakerSlug,
          voiceMap,
          segmentOverrides: activeOverrides,
          cast,
          voiceEnabledSlugs,
          rawContent: rawContent ?? text,
          storyLocale,
          storySettings,
        });
        blob = audioResult.blob;
        if (audioResult.ttsCostCents != null && audioResult.ttsCostCents > 0) {
          onTtsCostCents?.(audioResult.ttsCostCents);
        }

        if (!audioStoragePath && !turnId.startsWith("tmp-")) {
          const stored = await storeTurnAudioToCloud(turnId, blob);
          if (stored.ok && stored.path) {
            setCloudSaved(true);
            onStoragePath?.(stored.path);
            onCloudQuotaChange?.();
          }
        }
      }

      blobRef.current = blob;
      cleanupUrl();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      audioRef.current?.pause();
      const audio = new Audio(url);
      configureMobileHtmlAudio(audio);
      audioRef.current = audio;
      attachAudio(audio);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Story narration",
        });
      }

      setStatus("ready");
      return audio;
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
    };

    ensurePromiseRef.current = run().finally(() => {
      ensurePromiseRef.current = null;
    });
    return ensurePromiseRef.current;
  };

  const finishPlayWait = () => {
    playEndRef.current?.();
    playEndRef.current = null;
  };

  const handlePlayRejected = (
    error: unknown,
    reject: (reason?: unknown) => void,
  ) => {
    finishPlayWait();
    if (isAutoplayBlockedError(error)) {
      setStatus("ready");
      setError(null);
      setAutoplayBlocked(true);
      reject(error);
      return;
    }
    setAutoplayBlocked(false);
    setStatus("error");
    setError(error instanceof Error ? error.message : String(error));
    reject(error instanceof Error ? error : new Error(String(error)));
  };

  const sfxIdsForTurn = useCallback((): string[] => {
    const sfxSource = rawContent ?? text;
    return [
      ...parseSfxTags(sfxSource),
      ...(isStoryDeliveryEnabled(storySettings) &&
      !isPlotStateEmpty(storySettings?.plotState)
        ? ambienceIdsFromPlot(storySettings?.plotState)
        : []),
    ].filter((id, i, arr) => arr.indexOf(id) === i);
  }, [rawContent, text, storySettings]);

  const runSfxBeforePlay = async (options?: { resumeAmbience?: boolean }) => {
    const sfxIds = sfxIdsForTurn();
    if (options?.resumeAmbience && hasActiveAmbienceLoops()) {
      resumeAllSfxLoops();
    } else if (sfxIds.length) {
      await playSfxForTags(sfxIds);
    }
  };

  const finishWebAudioPlayback = useCallback(() => {
    webAudioActiveRef.current = false;
    stopAllSfx();
    setStatus("ready");
    setCurrentTime(0);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
    playEndRef.current?.();
    playEndRef.current = null;
  }, []);

  const startPlayback = async (
    audio: HTMLAudioElement,
    options?: { resumeAmbience?: boolean },
  ): Promise<void> => {
    if (shouldUseWebAudioForTts() && blobRef.current) {
      unlockAudioForAutoplay();
      await runSfxBeforePlay(options);
      setAutoplayBlocked(false);
      webAudioActiveRef.current = true;
      setStatus("playing");
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
      const { durationSec } = await playBlobViaWebAudio(
        blobRef.current,
        playbackRate,
      );
      if (durationSec > 0) setDuration(durationSec);
      finishWebAudioPlayback();
      return;
    }

    await runSfxBeforePlay(options);
    await audio.play();
    setAutoplayBlocked(false);
    setStatus("playing");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
    syncTimesFromAudio();
  };

  const play = async (): Promise<void> => {
    unlockAudioForAutoplay();
    const audio = await ensureAudio();
    if (!audio) {
      throw new Error("Audio nicht verfügbar");
    }

    return new Promise<void>((resolve, reject) => {
      finishPlayWait();
      playEndRef.current = () => resolve();

      void startPlayback(audio).catch((error) =>
        handlePlayRejected(error, reject),
      );
    });
  };

  const prepare = async (): Promise<void> => {
    const audio = await ensureAudio();
    if (!audio) {
      throw new Error("Audio nicht verfügbar");
    }
  };

  const pause = () => {
    if (webAudioActiveRef.current && isWebAudioTtsActive()) {
      pauseWebAudioPlayback();
    } else {
      audioRef.current?.pause();
    }
    pauseAllSfxLoops();
    setStatus("paused");
    syncTimesFromAudio();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  };

  const tryResumeOrPlay = async (audio: HTMLAudioElement | null) => {
    if (
      status === "paused" &&
      webAudioActiveRef.current &&
      isWebAudioTtsActive() &&
      blobRef.current
    ) {
      try {
        unlockAudioForAutoplay();
        await runSfxBeforePlay({ resumeAmbience: true });
        setAutoplayBlocked(false);
        setStatus("playing");
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
        resumeWebAudioPlayback();
        syncTimesFromAudio();
      } catch (error) {
        if (isAutoplayBlockedError(error)) {
          setStatus("ready");
          setError(null);
          setAutoplayBlocked(true);
          return;
        }
        setAutoplayBlocked(false);
        setStatus("error");
        setError(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (!audio) {
      await play();
      return;
    }
    try {
      await startPlayback(audio, { resumeAmbience: status === "paused" });
    } catch (error) {
      if (isAutoplayBlockedError(error)) {
        setStatus("ready");
        setError(null);
        setAutoplayBlocked(true);
        return;
      }
      setAutoplayBlocked(false);
      setStatus("error");
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const togglePlay = async () => {
    if (status === "loading") return;
    unlockAudioForAutoplay();
    if (status === "playing") {
      pause();
      return;
    }
    if (autoplayChain && onChainPlay) {
      onChainPlay();
      return;
    }
    if (status === "paused") {
      await tryResumeOrPlay(audioRef.current);
      return;
    }
    if (status === "ready" && audioRef.current) {
      await tryResumeOrPlay(audioRef.current);
      return;
    }
    try {
      await play();
    } catch (error) {
      if (!isAutoplayBlockedError(error)) {
        setStatus("error");
        setError(error instanceof Error ? error.message : String(error));
      }
    }
  };

  const downloadToDevice = async () => {
    if (saving) return;
    setSaving(true);
    unlockAudioForAutoplay();
    try {
      if (blobRef.current) {
        downloadBlob(
          blobRef.current,
          audioFilenameForTurn(turnId, chapterTitle),
        );
        return;
      }
      const result = await saveTurnAudioToDevice({
        turnId,
        text,
        rawContent,
        audioStoragePath,
        speakerSlug,
        voiceMap,
        voiceEnabledSlugs,
        cast,
        storyLocale,
        storySettings,
        chapterTitle,
      });
      if (!result.ok) setError(result.error ?? "Download fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const saveToCloud = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    unlockAudioForAutoplay();
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Bitte einloggen, um in der Cloud zu speichern.");
        return;
      }
      if (turnId.startsWith("tmp-")) {
        setError("Nachricht noch nicht gespeichert — bitte kurz warten.");
        return;
      }

      let blob = blobRef.current;
      if (!blob) {
        await ensureAudio();
        blob = blobRef.current;
      }
      if (!blob) {
        setError("Keine Audio-Datei — zuerst ▶ zum Erzeugen tippen.");
        return;
      }

      const stored = await storeTurnAudioToCloud(turnId, blob);
      if (stored.ok && stored.path) {
        setCloudSaved(true);
        onStoragePath?.(stored.path);
        onCloudQuotaChange?.();
        return;
      }
      setError(stored.error ?? "Cloud-Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const resetPlayback = () => {
    finishPlayWait();
    stopAllSfx();
    webAudioActiveRef.current = false;
    stopActiveTtsSource();
    stopTick();
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    cleanupUrl();
    blobRef.current = null;
    audioRef.current = null;
    setStatus("idle");
    setCurrentTime(0);
    setDuration(0);
    setAutoplayBlocked(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      prepare,
      play,
      pause,
      stop: resetPlayback,
    }),
    // play/pause/resetPlayback close over latest state — acceptable for queue control
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playbackRate, text, audioStoragePath, segmentOverrides],
  );

  const changeRate = (delta: number) => {
    const next = clampPlaybackRate(playbackRate + delta);
    setPlaybackRate(next);
    savePlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seekTo = (value: number) => {
    const t = Math.min(duration, Math.max(0, value));
    if (webAudioActiveRef.current && isWebAudioTtsActive()) {
      seekWebAudioPlayback(t);
      setCurrentTime(t);
      if (status === "paused") {
        setStatus("playing");
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const skip = (deltaSec: number) => {
    seekTo(currentTime + deltaSec);
  };

  const showTransport =
    status === "ready" ||
    status === "playing" ||
    status === "paused" ||
    status === "error";

  const isActive = status === "playing" || status === "paused";
  const showSeek = duration > 0 || isActive || status === "ready";

  const mainLabel =
    status === "loading"
      ? "…"
      : status === "playing"
        ? "‖"
        : status === "error"
          ? "!"
          : "▶";

  return (
    <div className="mt-2 border-t border-surface-border/60 pt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={status === "loading"}
          className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm text-accent disabled:opacity-50"
          aria-label={
            status === "playing" ? "Pause" : "Abspielen"
          }
        >
          {mainLabel}
        </button>
        <span className="min-w-0 flex-1 text-xs text-zinc-500">
          {status === "loading"
            ? "Audio wird erzeugt…"
            : status === "playing"
              ? "Läuft…"
              : status === "paused"
                ? "Pausiert"
                : status === "ready" && autoplayBlocked
                  ? autoplayBlockedHint()
                  : status === "ready"
                    ? "Bereit — Abspielen"
                    : "Anhören"}
        </span>
        {status !== "loading" ? (
          <>
            <button
              type="button"
              onClick={() => void saveToCloud()}
              disabled={saving || cloudSaved}
              className="shrink-0 rounded px-2 py-1 text-xs text-accent hover:text-accent/90 disabled:opacity-50"
              title={
                cloudSaved
                  ? "Bereits in der Cloud gespeichert"
                  : "MP3 in Supabase Cloud speichern"
              }
            >
              {saving ? "…" : cloudSaved ? "✓ Cloud" : "Cloud"}
            </button>
            <button
              type="button"
              onClick={() => void downloadToDevice()}
              disabled={saving}
              className="shrink-0 rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
              title="MP3 auf Gerät herunterladen"
            >
              ↓
            </button>
          </>
        ) : null}
        {showTransport ? (
          <button
            type="button"
            onClick={resetPlayback}
            className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Schließen
          </button>
        ) : null}
        {error ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : null}
      </div>

      {status !== "loading" ? (
        <div className="mt-2 space-y-2">
          {showSeek ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isActive && status !== "ready"}
              onClick={() => skip(-10)}
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-surface-border/40 disabled:opacity-30"
              aria-label="10 Sekunden zurück"
            >
              −10s
            </button>
            <span className="w-9 shrink-0 text-[10px] tabular-nums text-zinc-500">
              {formatAudioTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={duration ? currentTime : 0}
              disabled={!duration}
              onPointerDown={() => setSeeking(true)}
              onPointerUp={() => setSeeking(false)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-accent disabled:opacity-40"
              aria-label="Wiedergabeposition"
            />
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-zinc-500">
              {formatAudioTime(duration)}
            </span>
            <button
              type="button"
              disabled={!isActive && status !== "ready"}
              onClick={() => skip(10)}
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-surface-border/40 disabled:opacity-30"
              aria-label="10 Sekunden vor"
            >
              +10s
            </button>
          </div>
          ) : null}

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={playbackRate <= PLAYBACK_RATE_MIN}
              onClick={() => changeRate(-PLAYBACK_RATE_STEP)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-border text-sm text-zinc-400 disabled:opacity-30"
              aria-label="Langsamer"
            >
              −
            </button>
            <span className="w-14 text-center text-xs tabular-nums text-zinc-400">
              {formatPlaybackRate(playbackRate)}
            </span>
            <button
              type="button"
              disabled={playbackRate >= PLAYBACK_RATE_MAX}
              onClick={() => changeRate(PLAYBACK_RATE_STEP)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-border text-sm text-zinc-400 disabled:opacity-30"
              aria-label="Schneller"
            >
              +
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

MessageAudioPlayer.displayName = "MessageAudioPlayer";
