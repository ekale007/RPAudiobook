"use client";

import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";

type BillingConfig = {
  stripeConfigured: boolean;
  topupMinCents: number;
  topupMaxCents: number;
  topupMinEur: string;
  topupMaxEur: string;
  freeWeeklyBudgetEur: string;
};

type WalletData = {
  walletBalanceEur: string;
  walletBalanceCents: number;
  weeklyFreeRemainingCents: number;
  weeklyFreeBudgetCents: number;
  spendableCents: number;
  tier: string;
  periodWeek: string;
};

export function WalletTopupSection({
  wallet,
  onRefresh,
}: {
  wallet: WalletData | null;
  onRefresh?: () => void;
}) {
  const { locale, t } = useUiLocale();
  const moneyFmt = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
  });
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [amountEur, setAmountEur] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topupMsg, setTopupMsg] = useState<string | null>(null);

  useEffect(() => {
    void authFetch("/api/billing/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setConfig(data as BillingConfig);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      setTopupMsg(t("wallet.success"));
      onRefresh?.();
    } else if (params.get("topup") === "cancel") {
      setTopupMsg(t("wallet.cancel"));
    }
  }, [onRefresh, t]);

  const startCheckout = useCallback(async () => {
    if (!config?.stripeConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const euros = Number.parseFloat(amountEur.replace(",", "."));
      const amountCents = Math.round(euros * 100);
      const res = await authFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Checkout (${res.status})`);
      }
      if (body.url) {
        window.location.href = body.url as string;
        return;
      }
      throw new Error("Keine Checkout-URL");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [amountEur, config?.stripeConfigured]);

  const weeklyFreeEur =
    wallet && wallet.weeklyFreeBudgetCents > 0
      ? moneyFmt.format(wallet.weeklyFreeRemainingCents / 100)
      : null;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <h2 className="font-medium text-accent">{t("wallet.title")}</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {t("wallet.hint", {
          freeWeekly: config?.freeWeeklyBudgetEur ?? moneyFmt.format(2),
        })}
      </p>

      {wallet ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">{t("wallet.wallet")}</dt>
            <dd className="font-medium tabular-nums text-zinc-100">
              {wallet.walletBalanceEur}
            </dd>
          </div>
          {wallet.tier === "free" && weeklyFreeEur ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">{t("wallet.freeWeek")}</dt>
              <dd className="tabular-nums text-zinc-200">{weeklyFreeEur}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">{t("wallet.available")}</dt>
            <dd className="font-medium tabular-nums text-accent">
              {moneyFmt.format(wallet.spendableCents / 100)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">{t("wallet.loading")}</p>
      )}

      {topupMsg ? (
        <p className="mt-3 text-xs text-emerald-300/90">{topupMsg}</p>
      ) : null}

      {config?.stripeConfigured ? (
        <div className="mt-4 space-y-2">
          <label className="block text-xs text-zinc-400">
            {t("wallet.topupLabel", { min: config.topupMinEur })}
            <input
              type="number"
              min={config.topupMinCents / 100}
              max={config.topupMaxCents / 100}
              step="1"
              value={amountEur}
              onChange={(e) => setAmountEur(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void startCheckout()}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
          >
            {loading ? "…" : t("wallet.buy")}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">{t("wallet.stripeOff")}</p>
      )}

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </section>
  );
}
