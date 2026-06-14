"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/authFetch";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import type { UILocale } from "@/lib/i18n/types";

type LogEvent = {
  id: string;
  kind: string;
  status: string;
  label: string | null;
  modelId: string | null;
  providerRef: string | null;
  promptTokens: number;
  completionTokens: number;
  characters: number;
  costLabel: string;
  providerCostLabel: string | null;
  createdAt: string;
};

type LogPayload = {
  events: LogEvent[];
  summary: { totalLabel: string; count: number };
  error?: string;
};

function formatWhen(iso: string, locale: UILocale): string {
  try {
    return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function UsageLogPanel() {
  const { t, locale } = useUiLocale();
  const [data, setData] = useState<LogPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/usage/log?limit=80");
      const json = (await res.json()) as LogPayload;
      if (!res.ok) {
        setData({ events: [], summary: { totalLabel: "—", count: 0 }, error: json.error });
        return;
      }
      setData(json);
    } catch (e) {
      setData({
        events: [],
        summary: { totalLabel: "—", count: 0 },
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium text-accent">{t("usageLog.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{t("usageLog.hint")}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 text-xs text-accent underline"
        >
          {loading ? "…" : t("common.refresh")}
        </button>
      </div>

      {data?.error ? (
        <p className="mb-2 text-xs text-amber-300">{data.error}</p>
      ) : null}

      {data && !loading ? (
        <p className="mb-3 text-xs text-zinc-400">
          {t("usageLog.summary")} {data.summary.totalLabel} · {data.summary.count}{" "}
          {t("usageLog.rows")}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">{t("usageLog.loading")}</p>
      ) : !data?.events.length ? (
        <p className="text-sm text-zinc-500">{t("usageLog.empty")}</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-lg border border-surface-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-zinc-500">
              <tr>
                <th className="px-2 py-1.5 font-normal">{t("usageLog.colTime")}</th>
                <th className="px-2 py-1.5 font-normal">{t("usageLog.colKind")}</th>
                <th className="px-2 py-1.5 font-normal">{t("usageLog.colDetails")}</th>
                <th className="px-2 py-1.5 text-right font-normal">
                  {t("usageLog.colCost")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-t border-surface-border/60 text-zinc-300"
                >
                  <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500">
                    {formatWhen(ev.createdAt, locale)}
                  </td>
                  <td className="px-2 py-1.5 uppercase text-zinc-500">
                    {ev.kind}
                  </td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5">
                    {ev.label ?? "—"}
                    {ev.modelId ? (
                      <span className="block truncate text-[10px] text-zinc-600">
                        {ev.modelId}
                        {ev.kind === "llm"
                          ? ` · ${ev.promptTokens}+${ev.completionTokens} ${t("common.tokens")}`
                          : ev.characters
                            ? ` · ${ev.characters} ${t("common.characters")}`
                            : ""}
                      </span>
                    ) : null}
                    {ev.providerRef ? (
                      <span className="block truncate text-[10px] text-zinc-600">
                        Ref: {ev.providerRef}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {ev.costLabel}
                    {ev.providerCostLabel ? (
                      <span className="block text-[10px] text-zinc-600">
                        OR {ev.providerCostLabel}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
