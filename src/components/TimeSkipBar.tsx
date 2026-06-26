"use client";

import { useState } from "react";
import {
  TIME_SKIP_PRESETS,
  type TimeSkipId,
  type TimeSkipMode,
} from "@/lib/chat/timeskip";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { ui } from "@/lib/ui/classes";

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
    `${ui.btn} px-2 py-0.5 text-[10px] ${
      mode === value
        ? "border-accent/50 bg-accent/12 text-accent"
        : "text-zinc-400"
    }`;

  return (
    <div className={`${ui.panelInset} p-2`}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
          {t("timeskip.title")}
        </span>
        <div className="flex items-center gap-0.5" role="group" aria-label={t("timeskip.modeLabel")}>
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
      <div className="flex flex-wrap gap-1">
        {TIME_SKIP_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onTimeSkip(preset.id, mode)}
            className={`${ui.btn} px-2 py-1 text-[10px] text-zinc-200`}
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
      <p className="mt-1.5 text-[10px] leading-snug text-zinc-600">
        {mode === "montage" ? t("timeskip.montageHint") : t("timeskip.directHint")}
      </p>
    </div>
  );
}
