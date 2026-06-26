"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type {
  QuickReactionId,
  SteeringInputMode,
} from "@/lib/chat/playerSteering";
import type { TimeSkipId, TimeSkipMode } from "@/lib/chat/timeskip";
import { TimeSkipBar } from "@/components/TimeSkipBar";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { normalizeStoryContentLocale } from "@/lib/story/protagonist";
import { ui } from "@/lib/ui/classes";

const REACTIONS: Array<{
  id: QuickReactionId;
  labelKey: "steering.laugh" | "steering.cry" | "steering.smile";
  emoji: string;
}> = [
  { id: "laugh", emoji: "😂", labelKey: "steering.laugh" },
  { id: "cry", emoji: "😢", labelKey: "steering.cry" },
  { id: "smile", emoji: "😊", labelKey: "steering.smile" },
];

export function ChatSteeringBar({
  expanded,
  onToggleExpanded,
  input,
  onInputChange,
  onSend,
  onQuickReaction,
  onTimeSkip,
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
  onTimeSkip?: (id: TimeSkipId, mode: TimeSkipMode) => void;
  onEnsureExpanded?: () => void;
  placeholder: string;
  disabled?: boolean;
  generating?: boolean;
  onCancel?: () => void;
  children?: ReactNode;
  locale?: string | null;
  steeringMode?: boolean;
  steeringInputMode?: SteeringInputMode;
  onSteeringInputModeChange?: (mode: SteeringInputMode) => void;
}) {
  const { t } = useUiLocale();
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
    `${ui.btn} gap-1 px-2.5 py-1.5 ${
      steeringInputMode === mode
        ? "border-accent/50 bg-accent/12 text-accent"
        : "text-zinc-300"
    }`;

  return (
    <div className={ui.sectionGap}>
      <button
        type="button"
        onClick={onToggleExpanded}
        className={`${ui.panel} flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition hover:border-accent/30`}
        aria-expanded={expanded}
      >
        <span className="text-xs font-medium text-zinc-200">
          {t("steering.input")}
        </span>
        <span className="shrink-0 text-[10px] text-zinc-500" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      <div
        className={
          expanded
            ? ui.sectionGap
            : "pointer-events-none h-0 overflow-hidden opacity-0"
        }
        aria-hidden={!expanded}
      >
        <div className="flex flex-wrap items-center gap-1">
          {REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={disabled || generating}
              onClick={() => onQuickReaction(r.id)}
              className={`${ui.btn} gap-1 px-2 py-1`}
              title={t(r.labelKey)}
              aria-label={t(r.labelKey)}
            >
              <span className="text-base leading-none" aria-hidden>
                {r.emoji}
              </span>
              <span className="hidden text-[10px] text-zinc-400 sm:inline">
                {t(r.labelKey)}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={disabled || generating}
            onClick={handleSay}
            className={modeBtnClass("say")}
            title={t("steering.sayTitle")}
          >
            <span aria-hidden>💬</span>
            <span>{t("steering.say")}</span>
          </button>
          <button
            type="button"
            disabled={disabled || generating}
            onClick={handleAct}
            className={modeBtnClass("act")}
            title={t("steering.actTitle")}
          >
            <span aria-hidden>⚡</span>
            <span>{t("steering.act")}</span>
          </button>
        </div>

        {onTimeSkip ? (
          <TimeSkipBar
            disabled={disabled || generating}
            onTimeSkip={onTimeSkip}
          />
        ) : null}

        {children}

        <div className="flex gap-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className={`${ui.input} min-h-[2.75rem] flex-1 resize-none text-sm`}
            disabled={disabled || generating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!generating && !disabled) onSend();
              }
            }}
          />
          {generating ? (
            <button type="button" onClick={onCancel} className={ui.btnDanger}>
              {t("steering.stop")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled || !input.trim()}
              className={ui.btnPrimary}
            >
              {steeringMode ? t("steering.steer") : t("steering.send")}
            </button>
          )}
        </div>
        {steeringMode ? (
          <p className="text-center text-[10px] leading-snug text-zinc-600">
            {t("steering.hint")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
