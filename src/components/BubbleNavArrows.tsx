"use client";

type BubbleNavArrowsProps = {
  count: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
};

export function BubbleNavArrows({
  count,
  currentIndex,
  onPrev,
  onNext,
}: BubbleNavArrowsProps) {
  if (count <= 1) return null;

  const btnClass =
    "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-surface/90 text-base text-zinc-300 shadow-sm backdrop-blur-sm transition hover:border-accent/40 hover:text-accent disabled:pointer-events-none disabled:opacity-25";

  return (
    <div
      className="pointer-events-none absolute left-1 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 sm:left-2"
      aria-hidden={false}
    >
      <button
        type="button"
        disabled={currentIndex <= 0}
        onClick={onPrev}
        className={btnClass}
        aria-label="Vorherige Nachricht"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={currentIndex >= count - 1}
        onClick={onNext}
        className={btnClass}
        aria-label="Nächste Nachricht"
      >
        ↓
      </button>
    </div>
  );
}
