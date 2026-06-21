"use client";

import { brand } from "@/lib/brand";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OverlayPanel } from "@/components/ui/OverlayPanel";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

const STORAGE_KEY = "rp_audiobook_onboarding_v2";
const STEP_COUNT = 3;

export function BetaOnboardingModal({ openGate }: { openGate: boolean }) {
  const { t } = useUiLocale();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

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

  const stepBody = () => {
    if (step === 0) {
      return (
        <>
          <p className="mb-3 text-sm text-zinc-400">{t("onboarding.step1Intro")}</p>
          <p className="text-sm text-zinc-300">
            <strong className="text-zinc-200">{t("onboarding.stepLibrary")}</strong>{" "}
            {t("onboarding.stepLibraryText")}
          </p>
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <p className="mb-3 text-sm text-zinc-400">{t("onboarding.step2Intro")}</p>
          <p className="text-sm text-zinc-300">
            <strong className="text-zinc-200">{t("onboarding.stepProtagonist")}</strong>{" "}
            {t("onboarding.stepProtagonistText")}
          </p>
        </>
      );
    }
    return (
      <>
        <p className="mb-3 text-sm text-zinc-400">{t("onboarding.step3Intro")}</p>
        <p className="text-sm text-zinc-300">
          <strong className="text-zinc-200">{t("onboarding.stepHeadphones")}</strong>{" "}
          {t("onboarding.stepHeadphonesText")}
        </p>
        <p className="mt-3 text-xs text-zinc-500">{t("onboarding.disclaimer")}</p>
        <p className="mt-3 text-xs text-zinc-500">
          <Link href="/legal/datenschutz" className="text-accent underline">
            {t("legal.privacy")}
          </Link>
          {" · "}
          <Link href="/legal/nutzungsbedingungen" className="text-accent underline">
            {t("legal.terms")}
          </Link>
        </p>
      </>
    );
  };

  return (
    <OverlayPanel
      open={open}
      onClose={dismiss}
      title={t("onboarding.title", { product: brand.productName })}
      wide
    >
      <div className="mb-4 flex items-center justify-center gap-2" aria-hidden>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-8 rounded-full ${i === step ? "bg-accent" : "bg-surface-border"}`}
          />
        ))}
      </div>
      <p className="mb-1 text-center text-xs text-zinc-500">
        {t("onboarding.stepCounter", { current: String(step + 1), total: String(STEP_COUNT) })}
      </p>
      <div className="mb-6 min-h-[8rem]">{stepBody()}</div>
      <div className="flex gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm text-zinc-300"
          >
            {t("onboarding.back")}
          </button>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm text-zinc-500"
          >
            {t("onboarding.skip")}
          </button>
        )}
        {step < STEP_COUNT - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950"
          >
            {t("onboarding.next")}
          </button>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-zinc-950"
          >
            {t("onboarding.dismiss")}
          </button>
        )}
      </div>
    </OverlayPanel>
  );
}
