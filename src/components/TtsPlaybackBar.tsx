"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

export function TtsPlaybackBar({
  label,
  paused,
  onPause,
  onResume,
  onStop,
}: {
  label: string;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const { t } = useUiLocale();

  return (
    <div
      className="mb-2 flex items-center gap-2 rounded-xl border border-accent/30 bg-surface-raised px-3 py-2 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <span className="generating-indicator__dots shrink-0" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-accent/90">
        {label}
      </span>
      {paused ? (
        <button
          type="button"
          onClick={onResume}
          className="shrink-0 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent"
        >
          {t("chat.resume")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onPause}
          className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-200 hover:border-accent/40"
        >
          {t("chat.pause")}
        </button>
      )}
      <button
        type="button"
        onClick={onStop}
        className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300"
      >
        {t("chat.stopTts")}
      </button>
    </div>
  );
}
