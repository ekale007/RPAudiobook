"use client";

import { useState } from "react";
import {
  TIME_SKIP_PRESETS,
  type TimeSkipId,
  type TimeSkipMode,
} from "@/lib/chat/timeskip";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

export function TimeSkipBar({
  disabled,
  onTimeSkip,
}: {
  disabled?: boolean;
  onTimeSkip: (id: TimeSkipId, mode: TimeSkipMode) => void;
}) {
  const { t } = useUiLocale();
  const [mode, setMode] = useState<TimeSkipMode>("direct");

  const modeBtn = (value: TimeSkipMode) =>
    `rounded-lg border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
      mode === value
        ? "border-accent/55 bg-accent/15 text-accent"
        : "border-surface-border bg-surface-raised text-zinc-400 hover:border-accent/35"
    }`;

  return (
    <div className="rounded-xl border border-surface-border/80 bg-surface-raised/60 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-300">
          {t("timeskip.title")}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label={t("timeskip.modeLabel")}>
          <button
            type="button"
            disabled={disabled}
            className={modeBtn("direct")}
            onClick={() => setMode("direct")}
            title={t("timeskip.directTitle")}
          >
            {t("timeskip.direct")}
          </button>
          <button
            type="button"
            disabled={disabled}
            className={modeBtn("montage")}
            onClick={() => setMode("montage")}
            title={t("timeskip.montageTitle")}
          >
            {t("timeskip.montage")}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TIME_SKIP_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onTimeSkip(preset.id, mode)}
            className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-[11px] text-zinc-200 transition hover:border-accent/40 disabled:opacity-40"
            title={
              mode === "montage"
                ? t("timeskip.buttonMontageTitle", {
                    label: t(preset.labelKey),
                  })
                : t("timeskip.buttonDirectTitle", { label: t(preset.labelKey) })
            }
          >
            {t(preset.labelKey)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-zinc-600">
        {mode === "montage" ? t("timeskip.montageHint") : t("timeskip.directHint")}
      </p>
    </div>
  );
}
