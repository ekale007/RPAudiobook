"use client";

import {
  AUTO_PLAY_TURN_OPTIONS,
  DEFAULT_AUTO_PLAY_TURNS,
  DRIVE_MODE_MINUTES,
  type AutoPlayTurnCount,
  type DriveModeMinutes,
} from "@/lib/chat/autoContinue";

export function AutoPlayControls({
  disabled,
  onStart,
  onDriveStart,
}: {
  disabled?: boolean;
  onStart: (turns: AutoPlayTurnCount) => void;
  onDriveStart?: (minutes: DriveModeMinutes) => void;
}) {
  return (
    <div className="mb-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Automatisch:</span>
        {AUTO_PLAY_TURN_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onStart(n)}
            className="rounded-full border border-surface-border px-3 py-1 text-xs text-zinc-300 transition hover:border-accent/50 hover:text-accent disabled:opacity-40"
          >
            {n}×
            {n === DEFAULT_AUTO_PLAY_TURNS ? (
              <span className="sr-only"> (Standard)</span>
            ) : null}
          </button>
        ))}
      </div>
      {onDriveStart ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Fahren / Hören:</span>
            {DRIVE_MODE_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => onDriveStart(m)}
                className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
              >
                {m} Min
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-zinc-600">
            Schaltet Autoplay ein und liest jede neue Szene vor (ideal unterwegs).
          </p>
        </div>
      ) : null}
    </div>
  );
}
