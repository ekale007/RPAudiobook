"use client";

import type { StoryBeatOption } from "@/lib/chat/storyBeatSuggestions";

export function StoryBeatPicker({
  disabled,
  loading,
  options,
  onRequestBeats,
  onSelectBeat,
  onDismiss,
  onQuickContinue,
}: {
  disabled?: boolean;
  loading?: boolean;
  options: StoryBeatOption[] | null;
  onRequestBeats: () => void;
  onSelectBeat: (beat: StoryBeatOption) => void;
  onDismiss: () => void;
  onQuickContinue: () => void;
}) {
  if (options?.length) {
    return (
      <div className="mb-2 space-y-2">
        <p className="text-center text-xs text-zinc-500">
          Wohin soll die Story? Tippe eine Richtung an.
        </p>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectBeat(opt)}
            className="w-full rounded-xl border border-accent/40 bg-surface-raised px-3 py-2.5 text-left transition hover:border-accent/70 disabled:opacity-40"
          >
            <span className="block text-sm font-medium text-accent">
              {opt.title}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
              {opt.intro}
            </span>
          </button>
        ))}
        <div className="flex justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={onDismiss}
            className="text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Andere Vorschläge
          </button>
          <button
            type="button"
            onClick={onQuickContinue}
            disabled={disabled}
            className="text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-40"
          >
            Einfach weiterspielen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onRequestBeats}
        className="w-full rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-medium text-accent disabled:opacity-40"
      >
        Schlag was vor
      </button>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onQuickContinue}
        className="mt-1.5 w-full text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-40"
      >
        Ohne Vorschläge: Erzähler macht weiter
      </button>
    </div>
  );
}
