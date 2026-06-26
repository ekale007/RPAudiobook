"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { ui } from "@/lib/ui/classes";

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
      className={`${ui.panel} mb-1.5 flex items-center gap-1.5 border-accent/25 px-2.5 py-1.5`}
      role="status"
      aria-live="polite"
    >
      <span className="generating-indicator__dots shrink-0" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-accent/90">
        {label}
      </span>
      {paused ? (
        <button type="button" onClick={onResume} className={ui.btnAccent}>
          {t("chat.resume")}
        </button>
      ) : (
        <button type="button" onClick={onPause} className={ui.btn}>
          {t("chat.pause")}
        </button>
      )}
      <button type="button" onClick={onStop} className={ui.btnDanger}>
        {t("chat.stopTts")}
      </button>
    </div>
  );
}
