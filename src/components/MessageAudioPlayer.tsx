"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  downloadTurnAudio,
  setTurnAudioPath,
  uploadTurnAudio,
} from "@/lib/db/ttsStorage";
import { getNarratorAudio } from "@/lib/tts/narratorTts";
import type { VoiceMap } from "@/lib/types";
import { loadTtsSettings, ttsCacheVoiceKey } from "@/lib/storage/ttsSettings";
import { voiceForSpeaker } from "@/lib/tts/defaultVoiceMap";
import {
  buildTtsCacheKey,
  getCachedAudio,
  setCachedAudio,
} from "@/lib/storage/ttsAudioCache";

type Status = "idle" | "loading" | "playing" | "error";

export function MessageAudioPlayer({
  turnId,
  text,
  audioStoragePath,
  onStoragePath,
  speakerSlug,
  voiceMap,
}: {
  turnId: string;
  text: string;
  audioStoragePath?: string | null;
  onStoragePath?: (path: string) => void;
  speakerSlug?: string | null;
  voiceMap?: VoiceMap;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanupUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanupUrl(), [cleanupUrl]);

  const play = async () => {
    const settings = loadTtsSettings();
    if (settings.provider === "elevenlabs" && !settings.elevenLabsApiKey.trim()) {
      setError("Add ElevenLabs key in Settings or switch to Local TTS");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      let blob: Blob | null = null;

      const localVoice =
        settings.provider === "local" && voiceMap
          ? voiceForSpeaker(speakerSlug, voiceMap, settings.localVoice)
          : settings.localVoice;
      const cacheKey = buildTtsCacheKey(
        settings.provider === "local"
          ? `${ttsCacheVoiceKey(settings)}:${localVoice}`
          : ttsCacheVoiceKey(settings),
        settings.provider,
        text,
      );
      blob = await getCachedAudio(cacheKey);

      if (!blob && audioStoragePath) {
        blob = await downloadTurnAudio(audioStoragePath);
        if (blob) await setCachedAudio(cacheKey, blob);
      }

      if (!blob) {
        blob = await getNarratorAudio(settings, text, {
          speakerSlug,
          voiceMap,
        });

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && !turnId.startsWith("tmp-")) {
          const path = await uploadTurnAudio(user.id, turnId, blob);
          if (path) {
            await setTurnAudioPath(turnId, path);
            onStoragePath?.(path);
          }
        }
      }

      cleanupUrl();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Story narration",
        });
        navigator.mediaSession.playbackState = "playing";
      }

      audio.onended = () => {
        setStatus("idle");
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "none";
        }
      };
      audio.onerror = () => {
        setStatus("error");
        setError("Playback failed");
      };

      await audio.play();
      setStatus("playing");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stop = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setStatus("idle");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  };

  const label =
    status === "loading"
      ? "…"
      : status === "playing"
        ? "■"
        : status === "error"
          ? "!"
          : "▶";

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-surface-border/60 pt-2">
      <button
        type="button"
        onClick={status === "playing" ? stop : play}
        disabled={status === "loading"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs text-accent disabled:opacity-50"
        aria-label={status === "playing" ? "Stop narration" : "Play narration"}
      >
        {label}
      </button>
      <span className="text-xs text-zinc-500">
        {status === "playing"
          ? "Playing…"
          : status === "loading"
            ? "Generating audio…"
            : "Listen"}
      </span>
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
