"use client";

import { GeneratingIndicator } from "@/components/GeneratingIndicator";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

/**
 * Phases for the auto-close flow.
 *
 *  - `prompt`         user-confirm: jetzt abschließen / später
 *  - `closing`        server locked plot state (fast)
 *  - `summarizing`    server generating chapter summary (~5-15s, LLM)
 *  - `consolidating`  server running incremental band consolidation
 *  - `done`           server finished — client redirects to new chapter
 *  - `error`          recoverable error with retry + cancel
 */
export type AutoCloseOverlayPhase =
  | "prompt"
  | "closing"
  | "summarizing"
  | "consolidating"
  | "done"
  | "error";

const T = {
  de: {
    title: "Kapitel abschließen",
    promptLead:
      "Schließt das aktuelle Kapitel ab, speichert eine Zusammenfassung und startet das nächste — alles im Hintergrund, du kannst sofort weiterlesen.",
    promptNow: "Jetzt abschließen",
    promptManual: "Manuell gestalten",
    promptLater: "Später",
    closing: "Plot-Stand wird gesichert …",
    summarizing: "Kapitel-Zusammenfassung wird geschrieben …",
    consolidating: "Band-Übersicht wird konsolidiert …",
    done: "Fertig — springe ins neue Kapitel …",
    errorLead: "Beim Abschluss ist ein Fehler aufgetreten.",
    errorRetry: "Erneut versuchen",
    errorCancel: "Abbrechen",
  },
  en: {
    title: "Close chapter",
    promptLead:
      "Close the current chapter, save a summary and start the next one — all in the background, you can keep reading immediately.",
    promptNow: "Close now",
    promptManual: "Customize first",
    promptLater: "Later",
    closing: "Saving plot state …",
    summarizing: "Writing chapter summary …",
    consolidating: "Consolidating band summary …",
    done: "Done — opening next chapter …",
    errorLead: "Something went wrong while closing the chapter.",
    errorRetry: "Retry",
    errorCancel: "Cancel",
  },
};

export function AutoCloseOverlay({
  open,
  phase,
  status,
  onAutoClose,
  onManualTransition,
  onLater,
  onRetry,
  onCancelError,
  hardLimit = false,
}: {
  open: boolean;
  phase: AutoCloseOverlayPhase;
  status: string | null;
  onAutoClose: () => void;
  onManualTransition: () => void;
  onLater: () => void;
  onRetry: () => void;
  onCancelError: () => void;
  /** True when the auto-close was triggered by a hard-limit (56+ turns) hint. */
  hardLimit?: boolean;
}) {
  // Hooks first.
  const { locale } = useUiLocale();
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const t = T[lang];

  if (!open) return null;

  // Running phases: blocking modal with the same GeneratingIndicator look.
  if (phase === "closing" || phase === "summarizing" || phase === "consolidating" || phase === "done") {
    const label =
      status ??
      (phase === "closing"
        ? t.closing
        : phase === "summarizing"
          ? t.summarizing
          : phase === "consolidating"
            ? t.consolidating
            : t.done);
    return (
      <OverlayPanel
        open
        onClose={() => {}}
        title={t.title}
        blocking
        hideClose
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm leading-relaxed text-zinc-300">
            {phase === "done"
              ? t.done
              : lang === "de"
                ? "Das passiert im Hintergrund auf dem Server. Du kannst den Tab geöffnet lassen — du wirst automatisch ins neue Kapitel weitergeleitet, sobald alles fertig ist."
                : "This runs in the background on the server. You can keep the tab open — you'll be redirected to the next chapter as soon as it's ready."}
          </p>
          <GeneratingIndicator label={label} onCancel={undefined} />
        </div>
      </OverlayPanel>
    );
  }

  // Error: blocking but with retry/cancel — recoverable.
  if (phase === "error") {
    return (
      <OverlayPanel
        open
        onClose={onCancelError}
        title={t.title}
        blocking
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm leading-relaxed text-rose-200">
            {status ?? t.errorLead}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-accent py-3 text-sm font-medium text-black"
          >
            {t.errorRetry}
          </button>
          <button
            type="button"
            onClick={onCancelError}
            className="rounded-xl border border-surface-border bg-surface-raised py-3 text-sm font-medium text-zinc-200"
          >
            {t.errorCancel}
          </button>
        </div>
      </OverlayPanel>
    );
  }

  // prompt: user decides.
  return (
    <OverlayPanel
      open
      onClose={onLater}
      title={t.title}
      blocking
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm leading-relaxed text-zinc-300">
          {hardLimit
            ? lang === "de"
              ? "Dieses Kapitel ist sehr lang — der Abschluss wird empfohlen, damit das LLM den Faden nicht verliert."
              : "This chapter is very long — closing it is recommended so the LLM doesn't lose the thread."
            : t.promptLead}
        </p>
        <button
          type="button"
          onClick={onAutoClose}
          className="rounded-xl bg-accent py-3 text-sm font-medium text-black"
        >
          {t.promptNow}
        </button>
        <button
          type="button"
          onClick={onManualTransition}
          className="rounded-xl border border-surface-border bg-surface-raised py-3 text-sm font-medium text-zinc-200"
        >
          {t.promptManual}
        </button>
        <button
          type="button"
          onClick={onLater}
          className="text-center text-xs text-zinc-500 underline"
        >
          {t.promptLater}
        </button>
      </div>
    </OverlayPanel>
  );
}
