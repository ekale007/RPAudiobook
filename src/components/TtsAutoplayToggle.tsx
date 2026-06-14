"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import {
  loadTtsAutoplay,
  saveTtsAutoplay,
} from "@/lib/storage/ttsPlaybackSettings";
import {
  isTtsReadOnly,
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
  const { t } = useUiLocale();

  const toggle = () => {
    if (isTtsReadOnly()) return;
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
      disabled={disabled || isTtsReadOnly()}
      onPointerDown={() => {
        if (!isTtsReadOnly()) unlockAudioForAutoplay();
      }}
      onClick={toggle}
      className={`min-h-[44px] shrink-0 touch-manipulation rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
        enabled
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-surface-border text-zinc-400 hover:text-zinc-200"
      }`}
      title={
        enabled ? t("tts.autoplayTitleOn") : t("tts.autoplayTitleOff")
      }
    >
      {enabled ? t("tts.autoplayOn") : t("tts.autoplayOff")}
      {queueActive ? " · …" : ""}
    </button>
  );
}

/** Hydrate saved preference on client. */
export function readTtsAutoplayPreference(): boolean {
  return loadTtsAutoplay();
}
