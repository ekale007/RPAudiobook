"use client";

import { brand } from "@/lib/brand";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

const STORAGE_KEY = "hoerbuchki_onboarding_v1";

export function BetaOnboardingModal({ openGate }: { openGate: boolean }) {
  const { t } = useUiLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!openGate) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [openGate]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <OverlayPanel
      open={open}
      onClose={dismiss}
      title={t("onboarding.title", { product: brand.productName })}
      wide
    >
      <p className="mb-4 text-sm text-zinc-400">{t("onboarding.intro")}</p>
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
        <li>
          <strong className="text-zinc-200">{t("onboarding.stepLibrary")}</strong>{" "}
          {t("onboarding.stepLibraryText")}
        </li>
        <li>
          <strong className="text-zinc-200">{t("onboarding.stepChat")}</strong>{" "}
          {t("onboarding.stepChatText")}
        </li>
        <li>
          <strong className="text-zinc-200">{t("onboarding.stepHub")}</strong>{" "}
          {t("onboarding.stepHubText")}
        </li>
      </ol>
      <p className="mb-4 text-xs text-zinc-500">{t("onboarding.disclaimer")}</p>
      <p className="mb-4 text-xs text-zinc-500">
        <Link href="/legal/datenschutz" className="text-accent underline">
          {t("legal.privacy")}
        </Link>
        {" · "}
        <Link href="/legal/nutzungsbedingungen" className="text-accent underline">
          {t("legal.terms")}
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950"
      >
        {t("onboarding.dismiss")}
      </button>
    </OverlayPanel>
  );
}
