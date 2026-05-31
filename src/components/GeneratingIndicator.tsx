"use client";

export function GeneratingIndicator({
  label = "Geschichte wird geschreiben …",
  onCancel,
}: {
  label?: string;
  onCancel?: () => void;
}) {
  return (
    <div className="generating-indicator" role="status" aria-live="polite" aria-busy="true">
      <div className="generating-indicator__body min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="generating-indicator__dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="text-xs text-accent/90">{label}</span>
        </div>
        <div className="generating-indicator__bar mt-2" aria-hidden>
          <div className="generating-indicator__bar-fill" />
        </div>
      </div>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-zinc-300 hover:border-red-400/50 hover:text-red-300"
        >
          Abbrechen
        </button>
      ) : null}
    </div>
  );
}
