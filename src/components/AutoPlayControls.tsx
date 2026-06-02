"use client";

import {
  DRIVE_MODE_MINUTES,
  type DriveModeMinutes,
} from "@/lib/chat/autoContinue";
import { unlockAudioForAutoplay } from "@/lib/tts/audioUnlock";

export function AutoPlayControls({
  disabled,
  onDriveStart,
}: {
  disabled?: boolean;
  onDriveStart?: (minutes: DriveModeMinutes) => void;
}) {
  if (!onDriveStart) return null;

  return (
    <div className="mb-2 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Fahren / Hören:</span>
        {DRIVE_MODE_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onPointerDown={() => unlockAudioForAutoplay()}
            onClick={() => onDriveStart(m)}
            className="min-h-[44px] touch-manipulation rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
          >
            {m} Min
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-zinc-600">
        Schaltet Autoplay ein — nächste Szene wird während dem Vorlesen
        vorbereitet.
      </p>
    </div>
  );
}
