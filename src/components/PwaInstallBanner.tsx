"use client";

import { useCallback, useEffect, useState } from "react";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import {
  dismissInstallPrompt,
  isIosSafari,
  isMobileUa,
  isStandaloneDisplay,
  wasInstallDismissed,
} from "@/lib/pwa/installState";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallBanner() {
  const { t } = useUiLocale();
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (!isMobileUa() || isStandaloneDisplay() || wasInstallDismissed()) {
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      setIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBip);

    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const close = useCallback(() => {
    dismissInstallPrompt();
    setVisible(false);
    setDeferred(null);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    close();
  }, [close, deferred]);

  if (!visible) return null;

  return (
    <div
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-accent/30 bg-surface-raised/95 px-4 py-3 shadow-lg backdrop-blur-md"
      role="dialog"
      aria-label={t("pwa.installTitle")}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {t("pwa.installTitle")}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
              {iosHint ? t("pwa.installIosHint") : t("pwa.installAndroidHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            aria-label={t("pwa.dismiss")}
          >
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {deferred ? (
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black"
            >
              {t("pwa.installButton")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-400"
          >
            {t("pwa.later")}
          </button>
        </div>
      </div>
    </div>
  );
}
