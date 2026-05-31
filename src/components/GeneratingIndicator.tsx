"use client";

export function GeneratingIndicator({
  label = "Geschichte wird geschrieben …",
  onCancel,
}: {
  label?: string;
  onCancel?: () => void;
}) {
  return (
    <div
      className="generating-indicator"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="generating-indicator__dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="min-w-0 flex-1 text-xs text-accent/90">{label}</span>
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
