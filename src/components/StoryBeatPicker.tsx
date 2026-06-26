"use client";

import {
  AUTO_PLAY_TURN_OPTIONS,
  type AutoPlayTurnCount,
} from "@/lib/chat/autoContinue";
import type { StoryBeatOption } from "@/lib/chat/storyBeatSuggestions";

function NarratorContinueRow({
  disabled,
  loading,
  onQuickContinue,
  onAutoPlay,
}: {
  disabled?: boolean;
  loading?: boolean;
  onQuickContinue: () => void;
  onAutoPlay: (turns: AutoPlayTurnCount) => void;
}) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onQuickContinue}
        className="min-w-0 flex-1 rounded-xl border border-violet-400/30 bg-violet-500/10 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/15 disabled:opacity-40"
      >
        Erzähler macht weiter
      </button>
      <div className="flex shrink-0 items-center gap-1 self-stretch">
        {AUTO_PLAY_TURN_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled || loading}
            onClick={() => onAutoPlay(n)}
            className="flex h-full min-h-[36px] items-center rounded-lg border border-violet-400/25 px-2 text-[10px] font-medium text-violet-300/90 transition hover:border-violet-400/45 hover:bg-violet-500/10 disabled:opacity-40"
            title={`${n} Erzähler-Abschnitte schreiben (ohne Vorlesen)`}
          >
            {n}×
          </button>
        ))}
      </div>
    </div>
  );
}

export function StoryBeatPicker({
  disabled,
  loading,
  options,
  onRequestBeats,
  onSelectBeat,
  onDismiss,
  onQuickContinue,
  onAutoPlay,
}: {
  disabled?: boolean;
  loading?: boolean;
  options: StoryBeatOption[] | null;
  onRequestBeats: () => void;
  onSelectBeat: (beat: StoryBeatOption) => void;
  onDismiss: () => void;
  onQuickContinue: () => void;
  onAutoPlay: (turns: AutoPlayTurnCount) => void;
}) {
  if (options?.length) {
    return (
      <div className="mb-1.5 space-y-1.5">
        <p className="text-center text-[10px] text-zinc-500">
          Wohin soll die Story? Tippe eine Richtung an.
        </p>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectBeat(opt)}
            className="w-full rounded-lg border border-accent/35 bg-surface-raised/90 px-2.5 py-2 text-left text-sm transition hover:border-accent/55 disabled:opacity-40"
          >
            <span className="block text-sm font-medium text-accent">
              {opt.title}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
              {opt.intro}
            </span>
          </button>
        ))}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Andere Vorschläge
          </button>
        </div>
        <NarratorContinueRow
          disabled={disabled}
          loading={loading}
          onQuickContinue={onQuickContinue}
          onAutoPlay={onAutoPlay}
        />
      </div>
    );
  }

  return (
    <div className="mb-2 space-y-1.5">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onRequestBeats}
        className="w-full rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-medium text-accent disabled:opacity-40"
      >
        Schlag was vor
      </button>
      <NarratorContinueRow
        disabled={disabled}
        loading={loading}
        onQuickContinue={onQuickContinue}
        onAutoPlay={onAutoPlay}
      />
    </div>
  );
}
