"use client";

import { saveTtsAutoplay } from "@/lib/storage/ttsPlaybackSettings";
import { setTtsReadOnly, stopAudioSession } from "@/lib/tts/audioUnlock";

export function TtsReadOnlyToggle({
  enabled,
  onChange,
  disabled,
  onStopPlayback,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Stop queue + autoplay when entering read-only. */
  onStopPlayback?: () => void;
}) {
  const toggle = () => {
    const next = !enabled;
    setTtsReadOnly(next);
    if (next) {
      saveTtsAutoplay(false);
      stopAudioSession();
      onStopPlayback?.();
    }
    onChange(next);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={toggle}
      className={`min-h-[44px] shrink-0 touch-manipulation rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
        enabled
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-surface-border text-zinc-400 hover:text-zinc-200"
      }`}
      title={
        enabled
          ? "Nur lesen — keine App-Audio-Session, Hintergrundmusik läuft weiter"
          : "Stumm schalten: nur Text lesen, z. B. mit eigener Musik"
      }
    >
      {enabled ? "Nur lesen · An" : "Nur lesen"}
    </button>
  );
}
