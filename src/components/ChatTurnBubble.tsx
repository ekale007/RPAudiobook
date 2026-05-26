"use client";

import { useState } from "react";
import { MessageAudioPlayer } from "@/components/MessageAudioPlayer";
import { speakerDisplayName } from "@/lib/chat/speakerDisplay";
import type { CharacterRow, TurnRow } from "@/lib/db/stories";
import type { VoiceMap } from "@/lib/types";

export function ChatTurnBubble({
  turn,
  cast,
  voiceMap,
  readOnly,
  onEdit,
  onRewind,
  onReroll,
  onStoragePath,
}: {
  turn: TurnRow;
  cast: CharacterRow[];
  voiceMap: VoiceMap;
  readOnly: boolean;
  onEdit: (turnId: string, content: string) => Promise<void>;
  onRewind: (turnId: string) => Promise<void>;
  onReroll?: (turnId: string) => Promise<void>;
  onStoragePath?: (turnId: string, path: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(turn.content);
  const [busy, setBusy] = useState(false);

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text || text === turn.content) {
      setEditing(false);
      setDraft(turn.content);
      return;
    }
    setBusy(true);
    try {
      await onEdit(turn.id, text);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<void>) => {
    if (
      !confirm(
        "This removes this message and everything after it. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`mb-3 flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm ${
          turn.role === "user"
            ? "bg-accent/20 text-zinc-100"
            : "bg-surface-raised border border-surface-border"
        }`}
      >
        {turn.role === "assistant" && turn.speaker_slug ? (
          <p className="mb-1 text-xs font-medium text-accent">
            {speakerDisplayName(turn.speaker_slug, cast)}
          </p>
        ) : null}

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-zinc-100"
          />
        ) : (
          <p className="prose-chat">{turn.content}</p>
        )}

        {turn.role === "assistant" && !turn.id.startsWith("tmp-") ? (
          <MessageAudioPlayer
            turnId={turn.id}
            text={turn.content}
            speakerSlug={turn.speaker_slug}
            voiceMap={voiceMap}
            audioStoragePath={turn.audio_storage_path}
            onStoragePath={(path) => onStoragePath?.(turn.id, path)}
          />
        ) : null}

        {!readOnly && !turn.id.startsWith("tmp-") ? (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-surface-border/60 pt-2">
            {editing ? (
              <>
                <ActionBtn
                  label="Save"
                  disabled={busy}
                  onClick={saveEdit}
                  accent
                />
                <ActionBtn
                  label="Cancel"
                  disabled={busy}
                  onClick={() => {
                    setDraft(turn.content);
                    setEditing(false);
                  }}
                />
              </>
            ) : (
              <>
                <ActionBtn
                  label="Edit"
                  disabled={busy}
                  onClick={() => {
                    setDraft(turn.content);
                    setEditing(true);
                  }}
                />
                <ActionBtn
                  label="Rewind here"
                  disabled={busy}
                  onClick={() => act(() => onRewind(turn.id))}
                />
                {turn.role === "assistant" && onReroll ? (
                  <ActionBtn
                    label="Reroll"
                    disabled={busy}
                    onClick={() => act(() => onReroll(turn.id))}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-2 py-1 text-xs ${
        accent
          ? "bg-accent text-black"
          : "border border-surface-border text-zinc-400 hover:text-zinc-200"
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );
}
