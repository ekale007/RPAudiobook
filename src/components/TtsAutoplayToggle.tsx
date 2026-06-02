"use client";

import {
  loadTtsAutoplay,
  saveTtsAutoplay,
} from "@/lib/storage/ttsPlaybackSettings";
import {
  startAudioSession,
  unlockAudioForAutoplay,
} from "@/lib/tts/audioUnlock";

export function TtsAutoplayToggle({
  enabled,
  onChange,
  disabled,
  queueActive,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  queueActive?: boolean;
}) {
  const toggle = () => {
    const next = !enabled;
    saveTtsAutoplay(next);
    if (next) {
      startAudioSession();
      unlockAudioForAutoplay();
    }
    onChange(next);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={() => unlockAudioForAutoplay()}
      onClick={toggle}
      className={`min-h-[44px] shrink-0 touch-manipulation rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
        enabled
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-surface-border text-zinc-400 hover:text-zinc-200"
      }`}
      title={
        enabled
          ? "Neue Erzähler-Nachrichten werden automatisch vorgelesen"
          : "TTS-Autoplay aus — nur manuell ▶"
      }
    >
      TTS-Autoplay {enabled ? "An" : "Aus"}
      {queueActive ? " · …" : ""}
    </button>
  );
}

/** Hydrate saved preference on client. */
export function readTtsAutoplayPreference(): boolean {
  return loadTtsAutoplay();
}
