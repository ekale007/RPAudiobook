"use client";

/**
 * Phase 7.2: Memory-consistency toast.
 *
 * The validation pass in `lib/memory/memoryValidation.ts` auto-corrects the
 * timeline silently (so the LLM never sees contradictions), but if any
 * conflicts were found we surface them here so the user can spot continuity
 * bugs before reading more. The toast is **non-blocking** — it lives below
 * the chapter progress bar, expands on click, and can be dismissed.
 *
 * UX (User-Preference "Integrierte UI"):
 *  - Sits inline in the chat header area (not a separate floating card)
 *  - One-line summary first, tap-to-expand shows the full conflict list
 *  - "Zeitschiene öffnen" jumps to the timeline page for manual correction
 *  - Persists nothing — closing the toast drops the conflict list
 */

import { useState } from "react";
import type { MemoryConflict, ConflictSeverity } from "@/lib/memory/memoryValidation";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

type Props = {
  conflicts: MemoryConflict[];
  onDismiss: () => void;
  onOpenTimeline: () => void;
};

const T = {
  de: {
    badge: (n: number) => `Story-Memory repariert: ${n} Konflikt${n === 1 ? "" : "e"}`,
    autoCorrected: "Timeline wurde automatisch korrigiert",
    expand: "Details anzeigen",
    collapse: "Details ausblenden",
    openTimeline: "Zeitschiene öffnen",
    dismiss: "Schließen",
    severity: {
      error: "Fehler",
      warn: "Warnung",
      info: "Hinweis",
    } satisfies Record<ConflictSeverity, string>,
  },
  en: {
    badge: (n: number) => `Story memory repaired: ${n} conflict${n === 1 ? "" : "s"}`,
    autoCorrected: "Timeline was auto-corrected",
    expand: "Show details",
    collapse: "Hide details",
    openTimeline: "Open timeline",
    dismiss: "Dismiss",
    severity: {
      error: "Error",
      warn: "Warning",
      info: "Info",
    } satisfies Record<ConflictSeverity, string>,
  },
};

export function MemoryConflictsToast({ conflicts, onDismiss, onOpenTimeline }: Props) {
  const { locale } = useUiLocale();
  const t = T[locale] ?? T.de;
  const [expanded, setExpanded] = useState(false);

  if (!conflicts.length) return null;

  // Group by kind for compact display.
  const grouped = new Map<string, MemoryConflict[]>();
  for (const c of conflicts) {
    const list = grouped.get(c.kind) ?? [];
    list.push(c);
    grouped.set(c.kind, list);
  }
  // Pick the worst severity for the badge color.
  const worstSeverity: ConflictSeverity = conflicts.some((c) => c.severity === "error")
    ? "error"
    : conflicts.some((c) => c.severity === "warn")
    ? "warn"
    : "info";

  const severityClass: Record<ConflictSeverity, string> = {
    error: "border-rose-500/40 bg-rose-500/10 text-rose-100",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    info: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  };
  const dotClass: Record<ConflictSeverity, string> = {
    error: "bg-rose-400",
    warn: "bg-amber-400",
    info: "bg-sky-400",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="memory-conflicts-toast"
      className={`mx-2 mt-1 rounded-lg border ${severityClass[worstSeverity]} px-3 py-2 text-xs shadow-sm backdrop-blur`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass[worstSeverity]}`} />
        <span className="font-medium">{t.badge(conflicts.length)}</span>
        <span className="opacity-70">· {t.autoCorrected}</span>
        <span className="ml-auto text-[10px] opacity-60">
          {expanded ? t.collapse : t.expand}
        </span>
      </button>
      {expanded ? (
        <div className="mt-2 space-y-1.5">
          {Array.from(grouped.entries()).map(([kind, list]) => (
            <div key={kind} className="rounded border border-white/5 bg-black/20 p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-70">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass[list[0].severity]}`} />
                {t.severity[list[0].severity]} · {list[0].kind} · ×{list.length}
              </div>
              <ul className="space-y-1">
                {list.slice(0, 5).map((c) => (
                  <li key={c.id} className="leading-snug">
                    {c.message}
                  </li>
                ))}
                {list.length > 5 ? (
                  <li className="opacity-60">… {list.length - 5} weitere</li>
                ) : null}
              </ul>
            </div>
          ))}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenTimeline}
              className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
            >
              {t.openTimeline}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
            >
              {t.dismiss}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
