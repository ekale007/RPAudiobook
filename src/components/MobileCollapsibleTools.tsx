"use client";

import { useState, type ReactNode } from "react";
import { ui } from "@/lib/ui/classes";

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
  open: controlledOpen,
  onOpenChange,
  activityLabel,
  onActivityCancel,
  onActivityPause,
  activityPauseLabel = "Pause",
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activityLabel?: string | null;
  onActivityCancel?: () => void;
  onActivityPause?: () => void;
  activityPauseLabel?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const active = Boolean(activityLabel?.trim());

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };

  const toggle = () => setOpen(!open);

  return (
    <div className="mb-1.5">
      {active ? (
        <div
          className={`${ui.panel} mb-1.5 flex items-center gap-1.5 border-accent/20 bg-accent/[0.04] px-2.5 py-1.5`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <button
            type="button"
            onClick={toggle}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left md:pointer-events-none"
            aria-expanded={open}
          >
            <ActivityDots />
            <span className="min-w-0 flex-1 truncate text-[11px] text-accent/90">
              {activityLabel}
            </span>
            <span
              className="shrink-0 text-[10px] text-zinc-500 md:hidden"
              aria-hidden
            >
              {open ? "▲" : "▼"}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {onActivityPause ? (
              <button
                type="button"
                onClick={onActivityPause}
                className={ui.btn}
              >
                {activityPauseLabel}
              </button>
            ) : null}
            {onActivityCancel ? (
              <button
                type="button"
                onClick={onActivityCancel}
                className={`${ui.btn} hover:border-red-400/45 hover:text-red-300`}
              >
                Abbrechen
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          className={`${ui.panel} mb-1.5 flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left md:hidden`}
          aria-expanded={open}
        >
          <span className="min-w-0 truncate text-[11px]">
            <span className="font-medium text-zinc-300">{title}</span>
            {hint ? (
              <span className="ml-1 text-zinc-500">· {hint}</span>
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
