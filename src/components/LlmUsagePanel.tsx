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
  monthly: {
    periodMonth: string;
    requestCount: number;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
    budgetCents: number;
    budgetRemainingCents: number;
  };
  labels: {
    used: string;
    budget: string;
    remaining: string;
  };
  warning?: string;
  tier?: string;
  tierLabel?: string;
};

function formatReset(resetAt: number): string {
  const min = Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
  return min < 60 ? `${min} Min.` : `${Math.ceil(min / 60)} Std.`;
}

export function LlmUsagePanel({ compact = false }: { compact?: boolean }) {
  const serverCaps = useServerCapabilities();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!serverCaps.serverLlm) return;
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
  }, [serverCaps.serverLlm]);

  useEffect(() => {
    if (!serverCaps.ready || !serverCaps.serverLlm) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [serverCaps.ready, serverCaps.serverLlm, refresh]);

  if (!serverCaps.ready || !serverCaps.serverLlm) return null;

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

  if (compact) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-zinc-400">
        <div className="flex items-center justify-between gap-2">
          <span>Beta LLM</span>
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
            {data.labels.used} / {data.labels.budget} ·{" "}
            {data.hourly.remaining}/{data.hourly.limit} diese Stunde
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
            LLM-Verbrauch
            {data?.tierLabel ? (
              <span className="ml-2 font-normal text-zinc-500">
                · {data.tierLabel}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Geschätzte Kosten (OpenRouter). Stündliches Limit und Monatsbudget
            hängen an deinem Tarif — siehe Account.
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

      {data ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-zinc-400">
              <span>Monat {data.monthly.periodMonth}</span>
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

          <div>
            <div className="mb-1 flex justify-between text-xs text-zinc-400">
              <span>Diese Stunde</span>
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

          {data.hourly.remaining <= 5 || monthlyPct >= 85 ? (
            <p className="text-xs text-amber-200/90">
              {monthlyPct >= 100
                ? "Monatsbudget erreicht — Chat pausiert bis zum nächsten Monat."
                : monthlyPct >= 85
                  ? "Budget fast aufgebraucht. Memory-Sync und Autoplay verbrauchen viele Zusatz-Anfragen."
                  : "Stündliches Limit fast erreicht — kurz warten oder weniger Autoplay/Memory-Last."}
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
    return "Stündliches LLM-Limit erreicht — siehe Settings → Beta LLM Verbrauch. Kurz warten.";
  }
  if (/budget/i.test(raw) || /budget_exceeded/i.test(raw)) {
    return "Monatliches Beta-Budget erreicht — siehe Settings → Verbrauch.";
  }
  if (/guardrail|data policy|privacy|no endpoints available/i.test(raw)) {
    return (
      "OpenRouter blockiert das Modell (Datenschutz/Guardrails). " +
      "In Settings dasselbe Modell wie für Chat nutzen oder openrouter.ai/settings/privacy anpassen."
    );
  }
  return raw.replace(/^LLM \d+: /, "");
}
