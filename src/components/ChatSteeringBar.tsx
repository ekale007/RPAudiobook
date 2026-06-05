"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type {
  QuickReactionId,
  SteeringInputMode,
} from "@/lib/chat/playerSteering";
import { normalizeStoryContentLocale } from "@/lib/story/protagonist";

const REACTIONS: Array<{
  id: QuickReactionId;
  emoji: string;
  labelDe: string;
  labelEn: string;
}> = [
  { id: "laugh", emoji: "😂", labelDe: "Lachen", labelEn: "Laugh" },
  { id: "cry", emoji: "😢", labelDe: "Weinen", labelEn: "Cry" },
  { id: "smile", emoji: "😊", labelDe: "Lächeln", labelEn: "Smile" },
];

export function ChatSteeringBar({
  expanded,
  onToggleExpanded,
  input,
  onInputChange,
  onSend,
  onQuickReaction,
  onEnsureExpanded,
  placeholder,
  disabled,
  generating,
  onCancel,
  children,
  locale,
  steeringMode = true,
  steeringInputMode = "auto",
  onSteeringInputModeChange,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickReaction: (id: QuickReactionId) => void;
  /** Open the input panel without toggling closed. */
  onEnsureExpanded?: () => void;
  placeholder: string;
  disabled?: boolean;
  generating?: boolean;
  onCancel?: () => void;
  children?: ReactNode;
  locale?: string | null;
  /** When false (read-only chat), primary action is a normal Send. */
  steeringMode?: boolean;
  steeringInputMode?: SteeringInputMode;
  onSteeringInputModeChange?: (mode: SteeringInputMode) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingDialogueCursor = useRef<number | null>(null);
  const contentLocale = normalizeStoryContentLocale(locale);
  const de = contentLocale === "de";

  useLayoutEffect(() => {
    if (pendingDialogueCursor.current === null) return;
    const el = textareaRef.current;
    if (!el) return;
    const pos = pendingDialogueCursor.current;
    pendingDialogueCursor.current = null;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [input]);

  const insertAtCursor = (snippet: string, cursorAfter: number) => {
    const el = textareaRef.current;
    if (!el) {
      onInputChange(input ? `${input}${snippet}` : snippet);
      pendingDialogueCursor.current = (input?.length ?? 0) + cursorAfter;
      return;
    }
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const next = input.slice(0, start) + snippet + input.slice(end);
    pendingDialogueCursor.current = start + cursorAfter;
    onInputChange(next);
  };

  const handleSay = () => {
    if (!expanded) onEnsureExpanded?.();
    onSteeringInputModeChange?.("say");
    const open = de ? "„" : '"';
    const close = de ? '"' : '"';
    insertAtCursor(`${open}${close}`, open.length);
  };

  const handleAct = () => {
    if (!expanded) onEnsureExpanded?.();
    onSteeringInputModeChange?.("act");
    const prefix = "⚡ ";
    const el = textareaRef.current;
    const atStart = !el || el.selectionStart === 0;
    if (atStart && !input.trimStart().startsWith("⚡")) {
      insertAtCursor(prefix, prefix.length);
      return;
    }
    insertAtCursor(prefix, prefix.length);
  };

  const modeBtnClass = (mode: SteeringInputMode) =>
    `flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
      steeringInputMode === mode
        ? "border-accent/55 bg-accent/15 text-accent"
        : "border-surface-border bg-surface-raised text-zinc-300 hover:border-accent/40"
    }`;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface-raised/80 px-3 py-2.5 text-left backdrop-blur-sm transition hover:border-accent/35"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-zinc-200">
          {de ? "Eingabe" : "Input"}
        </span>
        <span className="shrink-0 text-[10px] text-zinc-500" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      <div
        className={
          expanded
            ? "space-y-2"
            : "pointer-events-none h-0 overflow-hidden opacity-0"
        }
        aria-hidden={!expanded}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={disabled || generating}
              onClick={() => onQuickReaction(r.id)}
              className="flex items-center gap-1 rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm transition hover:border-accent/40 disabled:opacity-40"
              title={de ? r.labelDe : r.labelEn}
              aria-label={de ? r.labelDe : r.labelEn}
            >
              <span className="text-lg leading-none" aria-hidden>
                {r.emoji}
              </span>
              <span className="text-xs text-zinc-400">
                {de ? r.labelDe : r.labelEn}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={disabled || generating}
            onClick={handleSay}
            className={modeBtnClass("say")}
            title={de ? "Gesprochene Zeile (Anführungszeichen)" : "Spoken line (quotes)"}
          >
            <span aria-hidden>💬</span>
            <span>{de ? "Sagen" : "Say"}</span>
          </button>
          <button
            type="button"
            disabled={disabled || generating}
            onClick={handleAct}
            className={modeBtnClass("act")}
            title={de ? "Handlung beschreiben" : "Describe an action"}
          >
            <span aria-hidden>⚡</span>
            <span>{de ? "Tun" : "Act"}</span>
          </button>
        </div>

        {children}

        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="flex-1 resize-none rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base outline-none focus:border-accent"
            disabled={disabled || generating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!generating && !disabled) onSend();
              }
            }}
          />
          {generating ? (
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300"
            >
              {de ? "Stopp" : "Stop"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled || !input.trim()}
              className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              {steeringMode ? (de ? "Lenken" : "Steer") : de ? "Senden" : "Send"}
            </button>
          )}
        </div>
        {steeringMode ? (
          <p className="text-center text-[10px] leading-snug text-zinc-600">
            {de
              ? 'Handlung und „Dialog" beliebig kombinieren — 💬 setzt Anführungszeichen, ⚡ eine Handlung.'
              : 'Mix action and "dialogue" freely — 💬 inserts quotes, ⚡ an action beat.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
