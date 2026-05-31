"use client";

import { useState, type ReactNode } from "react";

const BAR_SHELL =
  "mb-2 flex items-center gap-2.5 rounded-xl border border-accent/20 bg-accent/[0.06] px-3 py-2";

function ActivityDots() {
  return (
    <span className="generating-indicator__dots shrink-0" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

/** Collapses extra chat toolbar controls on small screens; always open from md up. */
export function MobileCollapsibleTools({
  title,
  hint,
  children,
  defaultOpen = false,
  activityLabel,
  onActivityCancel,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  activityLabel?: string | null;
  onActivityCancel?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const active = Boolean(activityLabel?.trim());

  const toggle = () => setOpen((v) => !v);

  return (
    <div className="mb-2">
      {active ? (
        <div
          className={BAR_SHELL}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <button
            type="button"
            onClick={toggle}
            className="flex min-w-0 flex-1 items-center gap-2 text-left md:pointer-events-none"
            aria-expanded={open}
          >
            <ActivityDots />
            <span className="min-w-0 flex-1 truncate text-xs text-accent/90">
              {activityLabel}
            </span>
            <span
              className="shrink-0 text-[10px] text-zinc-500 md:hidden"
              aria-hidden
            >
              {open ? "▲" : "▼"}
            </span>
          </button>
          {onActivityCancel ? (
            <button
              type="button"
              onClick={onActivityCancel}
              className="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-zinc-300 hover:border-red-400/50 hover:text-red-300"
            >
              Abbrechen
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-left text-xs text-zinc-400 transition hover:border-accent/30 hover:text-zinc-200 md:hidden"
          aria-expanded={open}
        >
          <span className="min-w-0 truncate">
            <span className="font-medium text-zinc-300">{title}</span>
            {hint ? (
              <span className="ml-1.5 text-zinc-500">· {hint}</span>
            ) : null}
          </span>
          <span className="shrink-0 text-[10px] text-zinc-500" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </button>
      )}
      <div className={open ? "block" : "hidden md:block"}>{children}</div>
    </div>
  );
}
