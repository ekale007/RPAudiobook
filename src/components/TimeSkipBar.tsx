"use client";

import { useRef, useState } from "react";
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
  const selectRef = useRef<HTMLSelectElement>(null);

  const modeBtn = (value: TimeSkipMode) =>
    `${ui.btn} px-2 py-0.5 text-[10px] ${
      mode === value
        ? "border-accent/50 bg-accent/12 text-accent"
        : "text-zinc-400"
    }`;

  const handlePresetPick = (raw: string) => {
    if (!raw) return;
    onTimeSkip(raw as TimeSkipId, mode);
    if (selectRef.current) selectRef.current.selectedIndex = 0;
  };

  return (
    <div className={`${ui.panelInset} p-2`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
          {t("timeskip.title")}
        </span>
        <div
          className="flex shrink-0 items-center gap-0.5"
          role="group"
          aria-label={t("timeskip.modeLabel")}
        >
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
        <select
          ref={selectRef}
          disabled={disabled}
          defaultValue=""
          onChange={(e) => handlePresetPick(e.target.value)}
          className={`${ui.input} min-h-0 flex-1 py-1.5 text-xs md:max-w-[11rem]`}
          aria-label={t("timeskip.choose")}
          title={
            mode === "montage" ? t("timeskip.montageHint") : t("timeskip.directHint")
          }
        >
          <option value="" disabled>
            {t("timeskip.choose")}
          </option>
          {TIME_SKIP_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {t(preset.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
