"use client";

import { useEffect, useState } from "react";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function DecimalStepInput({
  value,
  onChange,
  min,
  max,
  step = 0.05,
  decimals = 2,
  className = "",
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  className?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(() => value.toFixed(decimals));

  useEffect(() => {
    setDraft(value.toFixed(decimals));
  }, [value, decimals]);

  const commit = (raw: string) => {
    const parsed = parseDecimalInput(raw);
    if (parsed == null) {
      setDraft(value.toFixed(decimals));
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    setDraft(next.toFixed(decimals));
  };

  const nudge = (delta: number) => {
    const next = clamp(Number((value + delta).toFixed(decimals)), min, max);
    onChange(next);
    setDraft(next.toFixed(decimals));
  };

  const btnClass =
    "flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface text-base text-zinc-300 hover:border-accent/40 hover:text-accent";

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        className={btnClass}
        aria-label={`${ariaLabel} verringern`}
        onClick={() => nudge(-step)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-center text-sm tabular-nums"
      />
      <button
        type="button"
        className={btnClass}
        aria-label={`${ariaLabel} erhöhen`}
        onClick={() => nudge(step)}
      >
        +
      </button>
    </div>
  );
}
