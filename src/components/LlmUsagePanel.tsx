"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";
import { useServerCapabilities } from "@/lib/server/useServerCapabilities";

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
  };
  warning?: string;
  ttsWarning?: string;
  tier?: string;
  tierLabel?: string;
};

function formatReset(resetAt: number): string {
  const min = Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
  return min < 60 ? `${min} Min.` : `${Math.ceil(min / 60)} Std.`;
}

function formatCharacters(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("de-DE");
}

export function LlmUsagePanel({ compact = false }: { compact?: boolean }) {
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
        Math.round((data.monthly.costCents / data.monthly.budgetCents) * 100),
      )
    : 0;
  const hourlyPct = data
    ? Math.min(
        100,
        Math.round((data.hourly.used / data.hourly.limit) * 100),
      )
    : 0;

  const barClass =
    monthlyPct >= 90
      ? "bg-red-500"
      : monthlyPct >= 70
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
          <span>Verbrauch</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-accent underline"
          >
            {loading ? "…" : "Aktualisieren"}
          </button>
        </div>
        {data ? (
          <p className="mt-1 text-zinc-300">
            {data.labels.totalUsed ?? data.labels.used} gesamt
            {ttsMonthly && ttsMonthly.costCents > 0 ? (
              <> · TTS {data.labels.ttsUsed} ({ttsSharePct}%)</>
            ) : null}
            {" · "}
            {data.hourly.remaining}/{data.hourly.limit} LLM/h
          </p>
        ) : (
          <p className="mt-1">Lade Verbrauch…</p>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium text-accent">
            Monatsverbrauch
            {data?.tierLabel ? (
              <span className="ml-2 font-normal text-zinc-500">
                · {data.tierLabel}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            LLM (OpenRouter) + TTS (ElevenLabs) — geschätzt in EUR. LLM zählt
            gegen dein Monatsbudget.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="shrink-0 text-xs text-accent underline"
        >
          {loading ? "…" : "Aktualisieren"}
        </button>
      </div>

      {data?.warning ? (
        <p className="mb-2 text-xs text-amber-300">{data.warning}</p>
      ) : null}
      {data?.ttsWarning ? (
        <p className="mb-2 text-xs text-amber-300">{data.ttsWarning}</p>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {total && total.costCents > 0 ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>Gesamt (LLM + TTS)</span>
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
                <span>LLM-Budget {data.monthly.periodMonth}</span>
                <span>
                  {data.labels.used} von {data.labels.budget} (
                  {data.labels.remaining} übrig)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full transition-all ${barClass}`}
                  style={{ width: `${monthlyPct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {data.monthly.requestCount} Anfragen · ca.{" "}
                {Math.round(data.monthly.promptTokens / 1000)}k Prompt- ·{" "}
                {Math.round(data.monthly.completionTokens / 1000)}k Antwort-Tokens
              </p>
            </div>
          ) : null}

          {ttsMonthly ? (
            <div className="rounded-lg border border-surface-border/80 bg-surface/50 px-3 py-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>TTS (ElevenLabs)</span>
                <span className="tabular-nums text-zinc-200">
                  {data.labels.ttsUsed ?? "0,00 €"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {ttsMonthly.requestCount} API-Aufrufe ·{" "}
                {formatCharacters(ttsMonthly.characters)} Zeichen
                {total && total.costCents > 0 && ttsMonthly.costCents > 0 ? (
                  <> · {ttsSharePct}% vom Gesamtverbrauch</>
                ) : null}
              </p>
              {data.ttsHourly ? (
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  Diese Stunde: {data.ttsHourly.used} / {data.ttsHourly.limit}{" "}
                  TTS-Anfragen
                </p>
              ) : null}
            </div>
          ) : null}

          {serverCaps.serverLlm ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-400">
                <span>LLM diese Stunde</span>
                <span>
                  {data.hourly.used} / {data.hourly.limit} Anfragen
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full bg-zinc-500 transition-all"
                  style={{ width: `${hourlyPct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Reset in ca. {formatReset(data.hourly.resetAt)} ·{" "}
                {data.hourly.remaining} verbleibend
              </p>
            </div>
          ) : null}

          {data.hourly.remaining <= 5 || monthlyPct >= 85 ? (
            <p className="text-xs text-amber-200/90">
              {monthlyPct >= 100
                ? "Monatsbudget erreicht — Chat pausiert bis zum nächsten Monat."
                : monthlyPct >= 85
                  ? "LLM-Budget fast aufgebraucht. Memory-Sync und Autoplay verbrauchen viele Zusatz-Anfragen."
                  : "Stündliches LLM-Limit fast erreicht — kurz warten oder weniger Autoplay/Memory-Last."}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Verbrauch wird geladen…</p>
      )}
    </section>
  );
}

export function formatLlmLimitError(raw: string): string {
  if (/rate limit exceeded/i.test(raw)) {
    return "Stündliches LLM-Limit erreicht — siehe Account → Monatsverbrauch. Kurz warten.";
  }
  if (/budget/i.test(raw) || /budget_exceeded/i.test(raw)) {
    return "Monatliches Beta-Budget erreicht — siehe Account → Verbrauch.";
  }
  if (/guardrail|data policy|privacy|no endpoints available/i.test(raw)) {
    return (
      "OpenRouter blockiert das Modell (Datenschutz/Guardrails). " +
      "In Settings dasselbe Modell wie für Chat nutzen oder openrouter.ai/settings/privacy anpassen."
    );
  }
  return raw.replace(/^LLM \d+: /, "");
}
