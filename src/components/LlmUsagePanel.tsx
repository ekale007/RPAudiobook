"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";
import { useServerCapabilities } from "@/lib/server/useServerCapabilities";
import { translate } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { DEFAULT_UI_LOCALE, type UILocale } from "@/lib/i18n/types";

type UsagePayload = {
  hourly: {
    used: number;
    limit: number;
    resetAt: number;
    remaining: number;
  };
  ttsHourly?: {
    used: number;
    limit: number;
    resetAt: number;
    remaining: number;
  };
  monthly: {
    periodMonth: string;
    requestCount: number;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
    budgetCents: number;
    budgetRemainingCents: number;
  };
  ttsMonthly?: {
    periodMonth: string;
    requestCount: number;
    characters: number;
    costCents: number;
  };
  total?: {
    costCents: number;
    ttsSharePct: number;
    llmSharePct: number;
  };
  labels: {
    used: string;
    budget: string;
    remaining: string;
    ttsUsed?: string;
    totalUsed?: string;
    walletBalance?: string;
    spendable?: string;
    weeklyFreeRemaining?: string;
  };
  wallet?: {
    walletBalanceEur: string;
    spendableCents: number;
    weeklyFreeRemainingCents: number;
    weeklyFreeBudgetCents: number;
    tier: string;
    periodWeek: string;
  };
  walletWarning?: string;
  warning?: string;
  ttsWarning?: string;
  tier?: string;
  tierLabel?: string;
};

function formatReset(resetAt: number, locale: UILocale): string {
  const min = Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
  if (min < 60) {
    return translate(locale, "common.minutes", { min: String(min) });
  }
  return translate(locale, "common.hours", {
    hours: String(Math.ceil(min / 60)),
  });
}

function formatCharacters(n: number, locale: UILocale): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString(locale === "de" ? "de-DE" : "en-US");
}

export function LlmUsagePanel({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useUiLocale();
  const serverCaps = useServerCapabilities();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(false);

  const canLoad = serverCaps.serverLlm || serverCaps.serverTts;

  const refresh = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/llm/usage");
      if (res.ok) {
        setData((await res.json()) as UsagePayload);
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    if (!serverCaps.ready || !canLoad) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [serverCaps.ready, canLoad, refresh]);

  if (!serverCaps.ready || !canLoad) return null;

  const monthlyPct = data
    ? Math.min(
        100,
        Math.round(
          (data.monthly.costCents / Math.max(data.monthly.budgetCents, 1)) * 100,
        ),
      )
    : 0;
  const walletLow = data?.wallet ? data.wallet.spendableCents < 50 : false;
  const budgetPct = data?.wallet ? (walletLow ? 95 : 30) : monthlyPct;
  const hourlyPct = data
    ? Math.min(
        100,
        Math.round((data.hourly.used / data.hourly.limit) * 100),
      )
    : 0;

  const barClass =
    budgetPct >= 90
      ? "bg-red-500"
      : budgetPct >= 70
        ? "bg-amber-400"
        : "bg-accent";

  const ttsMonthly = data?.ttsMonthly;
  const total = data?.total;
  const llmSharePct = total?.llmSharePct ?? 0;
  const ttsSharePct = total?.ttsSharePct ?? 0;

  if (compact) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-zinc-400">
        <div className="flex items-center justify-between gap-2">
          <span>{t("usage.compactTitle")}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-accent underline"
          >
            {loading ? "…" : t("common.refresh")}
          </button>
        </div>
        {data ? (
          <p className="mt-1 text-zinc-300">
            {data.labels.spendable ?? data.labels.totalUsed ?? data.labels.used}{" "}
            {t("common.available")}
            {data.labels.totalUsed ? (
              <>
                {" "}
                · {data.labels.totalUsed} {t("common.spent")}
              </>
            ) : null}
            {" · "}
            {data.hourly.remaining}/{data.hourly.limit} LLM/h
          </p>
        ) : (
          <p className="mt-1">{t("usage.loading")}</p>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium text-accent">
            {t("usage.title")}
            {data?.tierLabel ? (
              <span className="ml-2 font-normal text-zinc-500">
                · {data.tierLabel}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t("usage.hint")}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="shrink-0 text-xs text-accent underline"
        >
          {loading ? "…" : t("common.refresh")}
        </button>
      </div>

      {data?.warning ? (
        <p className="mb-2 text-xs text-amber-300">{data.warning}</p>
      ) : null}
      {data?.ttsWarning ? (
        <p className="mb-2 text-xs text-amber-300">{data.ttsWarning}</p>
      ) : null}

      {data?.walletWarning ? (
        <p className="mb-2 text-xs text-amber-300">{data.walletWarning}</p>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {data.wallet ? (
            <div className="rounded-lg border border-surface-border/80 bg-surface/50 px-3 py-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>{t("usage.balanceAvailable")}</span>
                <span className="tabular-nums text-zinc-100">
                  {data.labels.spendable ?? data.wallet.walletBalanceEur}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {t("usage.walletLabel")}{" "}
                {data.labels.walletBalance ?? data.wallet.walletBalanceEur}
                {data.wallet.tier === "free" && data.labels.weeklyFreeRemaining
                  ? ` · ${t("usage.freeThisWeek")} ${data.labels.weeklyFreeRemaining}`
                  : null}
              </p>
            </div>
          ) : null}
          {total && total.costCents > 0 ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{t("usage.totalLlmTts")}</span>
                <span className="tabular-nums text-zinc-200">
                  {data.labels.totalUsed}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-surface">
                {llmSharePct > 0 ? (
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${llmSharePct}%` }}
                    title={`LLM ${llmSharePct}%`}
                  />
                ) : null}
                {ttsSharePct > 0 ? (
                  <div
                    className="h-full bg-sky-500/80 transition-all"
                    style={{ width: `${ttsSharePct}%` }}
                    title={`TTS ${ttsSharePct}%`}
                  />
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                <span>
                  <span className="inline-block h-2 w-2 rounded-sm bg-accent align-middle" />{" "}
                  LLM {data.labels.used} ({llmSharePct}%)
                </span>
                {ttsMonthly && ttsMonthly.costCents > 0 ? (
                  <span>
                    <span className="inline-block h-2 w-2 rounded-sm bg-sky-500/80 align-middle" />{" "}
                    TTS {data.labels.ttsUsed} ({ttsSharePct}%)
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {serverCaps.serverLlm ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>
                  {t("usage.llmMonth")} {data.monthly.periodMonth}
                </span>
                <span>{data.labels.used}</span>
              </div>
              {!data.wallet ? (
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full transition-all ${barClass}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              ) : null}
              <p className="mt-1 text-[11px] text-zinc-500">
                {data.monthly.requestCount} {t("common.requests")} · ca.{" "}
                {Math.round(data.monthly.promptTokens / 1000)}k {t("usage.promptTokens")}{" "}
                · {Math.round(data.monthly.completionTokens / 1000)}k{" "}
                {t("usage.completionTokens")}
              </p>
            </div>
          ) : null}

          {ttsMonthly ? (
            <div className="rounded-lg border border-surface-border/80 bg-surface/50 px-3 py-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>{t("usage.ttsEleven")}</span>
                <span className="tabular-nums text-zinc-200">
                  {data.labels.ttsUsed ?? "0,00 €"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {ttsMonthly.requestCount} {t("usage.apiCalls")} ·{" "}
                {formatCharacters(ttsMonthly.characters, locale)}{" "}
                {t("common.characters")}
                {total && total.costCents > 0 && ttsMonthly.costCents > 0 ? (
                  <>
                    {" "}
                    · {ttsSharePct}% {t("usage.ofTotal")}
                  </>
                ) : null}
              </p>
              {data.ttsHourly ? (
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {t("usage.thisHour")} {data.ttsHourly.used} /{" "}
                  {data.ttsHourly.limit} {t("usage.ttsRequests")}
                </p>
              ) : null}
            </div>
          ) : null}

          {serverCaps.serverLlm ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>{t("usage.llmThisHour")}</span>
                <span>
                  {data.hourly.used} / {data.hourly.limit} {t("common.requests")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full bg-zinc-500 transition-all"
                  style={{ width: `${hourlyPct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {t("common.resetIn")} {formatReset(data.hourly.resetAt, locale)} ·{" "}
                {data.hourly.remaining} {t("common.remaining")}
              </p>
            </div>
          ) : null}

          {data.hourly.remaining <= 5 || walletLow || monthlyPct >= 85 ? (
            <p className="text-xs text-amber-200/90">
              {walletLow
                ? t("usage.warnWalletLow")
                : monthlyPct >= 100
                  ? t("usage.warnBudgetHigh")
                  : monthlyPct >= 85
                    ? t("usage.warnBudget85")
                    : t("usage.warnHourly")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{t("usage.loading")}</p>
      )}
    </section>
  );
}

export function formatLlmLimitError(
  raw: string,
  locale: UILocale = DEFAULT_UI_LOCALE,
): string {
  if (/rate limit exceeded/i.test(raw)) {
    return translate(locale, "usage.errors.rateLimit");
  }
  if (/budget/i.test(raw) || /budget_exceeded/i.test(raw)) {
    return translate(locale, "usage.errors.budget");
  }
  if (/insufficient_balance|guthaben/i.test(raw)) {
    return translate(locale, "usage.errors.insufficient");
  }
  if (/guardrail|data policy|privacy|no endpoints available/i.test(raw)) {
    return translate(locale, "usage.errors.guardrail");
  }
  return raw.replace(/^LLM \d+: /, "");
}
