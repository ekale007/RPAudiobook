"use client";

/**
 * Phase 8.1: Auto-close progress toast.
 *
 * User-UX-Preference "Integrierte UI" — the running phases of the auto-close
 * flow (closing → summarizing → consolidating → done | error) are surfaced
 * as a non-blocking inline toast below the ChapterProgressBar, NOT as a
 * blocking modal. This way the user can keep reading the chat while the
 * server works (5-15s typical), and on `done` we offer a one-tap jump to
 * the new chapter without covering the screen.
 *
 * Pattern is the same as `MemoryConflictsToast` (Phase 7.2): severity-
 * coloured border, tap-to-expand, dismissable, action buttons inline.
 *
 * Phases:
 *  - closing / summarizing / consolidating  → sky/info, "Wird abgeschlossen …"
 *  - done                                   → accent/success, "Fertig — zum neuen Kapitel"
 *  - error                                  → rose/error, server error message + retry
 */

import { useState } from "react";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import type { AutoCloseOverlayPhase } from "@/components/AutoCloseOverlay";

type Props = {
  phase: AutoCloseOverlayPhase;
  status: string | null;
  /** When set, the done-state shows a "jump to new chapter" link. */
  newChapterHref?: string | null;
  onRetry: () => void;
  onCancel: () => void;
  onDismiss: () => void;
};

const T = {
  de: {
    runningTitle: "Kapitel wird abgeschlossen",
    doneTitle: "Kapitel abgeschlossen",
    errorTitle: "Abschluss fehlgeschlagen",
    jumpToNew: "→ Neues Kapitel öffnen",
    retry: "Erneut versuchen",
    cancel: "Abbrechen",
    dismiss: "Schließen",
    expand: "Details",
    collapse: "Weniger",
  },
  en: {
    runningTitle: "Closing chapter",
    doneTitle: "Chapter closed",
    errorTitle: "Close failed",
    jumpToNew: "→ Open new chapter",
    retry: "Retry",
    cancel: "Cancel",
    dismiss: "Dismiss",
    expand: "Details",
    collapse: "Less",
  },
};

function isRunningPhase(phase: AutoCloseOverlayPhase): boolean {
  return (
    phase === "closing" ||
    phase === "summarizing" ||
    phase === "consolidating"
  );
}

export function AutoCloseToast({
  phase,
  status,
  newChapterHref,
  onRetry,
  onCancel,
  onDismiss,
}: Props) {
  const { locale } = useUiLocale();
  const t = T[locale] ?? T.de;
  const [expanded, setExpanded] = useState(false);

  // The prompt phase is owned by AutoCloseOverlay; the toast is for the
  // post-confirm phases only.
  if (phase === "prompt") return null;

  const isRunning = isRunningPhase(phase);
  const isDone = phase === "done";
  const isError = phase === "error";

  // Severity-styled border + dot.
  const severityClass = isError
    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
    : isDone
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
      : "border-sky-500/40 bg-sky-500/10 text-sky-100";
  const dotClass = isError
    ? "bg-rose-400"
    : isDone
      ? "bg-emerald-400"
      : "bg-sky-400";
  const titleText = isError
    ? t.errorTitle
    : isDone
      ? t.doneTitle
      : t.runningTitle;
  // Sub-text: server status string, or default.
  const subtitle =
    status ??
    (isRunning
      ? "Server arbeitet — du kannst weiterlesen."
      : isDone
        ? "Speichern fertig."
        : "");

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="auto-close-toast"
      className={`mx-2 mt-1 rounded-lg border ${severityClass} px-3 py-2 text-xs shadow-sm backdrop-blur`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass} ${isRunning ? "animate-pulse" : ""}`}
        />
        <span className="font-medium">{titleText}</span>
        <span className="min-w-0 flex-1 truncate opacity-70">· {subtitle}</span>
        <span className="shrink-0 text-[10px] opacity-60">
          {expanded ? t.collapse : t.expand}
        </span>
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2">
          {status ? (
            <p className="leading-snug opacity-80">{status}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {isDone && newChapterHref ? (
              <a
                href={newChapterHref}
                className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
              >
                {t.jumpToNew}
              </a>
            ) : null}
            {isError ? (
              <>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
                >
                  {t.retry}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
                >
                  {t.cancel}
                </button>
              </>
            ) : null}
            {!isRunning ? (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
              >
                {t.dismiss}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
