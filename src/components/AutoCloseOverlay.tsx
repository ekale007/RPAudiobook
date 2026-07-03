"use client";

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
 *
 * UX rule (Phase 8.1, user-reported): the running/error/done phases are
 * surfaced as a non-blocking inline toast (AutoCloseToast) below the
 * ChapterProgressBar, so the chat stays usable. Only the `prompt` phase
 * is a blocking modal — the user must confirm before any LLM work starts.
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
  },
  en: {
    title: "Close chapter",
    promptLead:
      "Close the current chapter, save a summary and start the next one — all in the background, you can keep reading immediately.",
    promptNow: "Close now",
    promptManual: "Customize first",
    promptLater: "Later",
  },
};

export function AutoCloseOverlay({
  phase,
  onAutoClose,
  onManualTransition,
  onLater,
  hardLimit = false,
}: {
  phase: AutoCloseOverlayPhase;
  onAutoClose: () => void;
  onManualTransition: () => void;
  onLater: () => void;
  /** True when the auto-close was triggered by a hard-limit (56+ turns) hint. */
  hardLimit?: boolean;
}) {
  // Hooks first.
  const { locale } = useUiLocale();
  const lang: "de" | "en" = locale === "en" ? "en" : "de";
  const t = T[lang];

  // Only the prompt phase is rendered as a blocking modal. All other
  // phases are surfaced inline via AutoCloseToast so the user can keep
  // reading while the server works.
  if (phase !== "prompt") return null;

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
