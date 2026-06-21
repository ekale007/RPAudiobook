"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

export function GeneratingIndicator({
  label,
  onCancel,
}: {
  label?: string;
  onCancel?: () => void;
}) {
  const { t } = useUiLocale();
  const displayLabel = label ?? t("chat.generating");

  return (
    <div className="generating-indicator" role="status" aria-live="polite" aria-busy="true">
      <div className="generating-indicator__body min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="generating-indicator__dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="text-xs text-accent/90">{displayLabel}</span>
        </div>
        <div className="generating-indicator__bar mt-2" aria-hidden>
          <div className="generating-indicator__bar-fill" />
        </div>
      </div>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 hover:border-red-400/60"
        >
          {t("chat.stopGeneration")}
        </button>
      ) : null}
    </div>
  );
}
