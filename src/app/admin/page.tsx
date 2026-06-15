"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { authFetch } from "@/lib/supabase/authFetch";
type UserTier = "free" | "beta" | "pro";

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

type TierLimitDefaults = {
  llmBudgetCents: number;
  llmPerHour: number;
  ttsPerHour: number;
  ttsStorageMax: number;
};

type TierLimitsMap = Record<UserTier, TierLimitDefaults>;

type AdminUser = {
  userId: string;
  email: string | null;
  tier: UserTier;
  limits: TierLimitDefaults;
  usage: { costCents: number; requestCount: number };
  walletBalanceCents: number;
};

const TIERS: UserTier[] = ["free", "beta", "pro"];

function draftFromTierLimits(map: TierLimitsMap): Record<UserTier, Record<keyof TierLimitDefaults, string>> {
  const out = {} as Record<UserTier, Record<keyof TierLimitDefaults, string>>;
  for (const tier of TIERS) {
    out[tier] = {
      llmBudgetCents: String(map[tier].llmBudgetCents),
      llmPerHour: String(map[tier].llmPerHour),
      ttsPerHour: String(map[tier].ttsPerHour),
      ttsStorageMax: String(map[tier].ttsStorageMax),
    };
  }
  return out;
}

function parseTierLimitsDraft(
  draft: Record<UserTier, Record<keyof TierLimitDefaults, string>>,
): TierLimitsMap | { error: string } {
  const result = {} as TierLimitsMap;
  for (const tier of TIERS) {
    const row = draft[tier];
    const llmBudgetCents = Number.parseInt(row.llmBudgetCents, 10);
    const llmPerHour = Number.parseInt(row.llmPerHour, 10);
    const ttsPerHour = Number.parseInt(row.ttsPerHour, 10);
    const ttsStorageMax = Number.parseInt(row.ttsStorageMax, 10);
    if (
      !Number.isFinite(llmBudgetCents) ||
      llmBudgetCents < 1 ||
      !Number.isFinite(llmPerHour) ||
      llmPerHour < 1 ||
      !Number.isFinite(ttsPerHour) ||
      ttsPerHour < 1 ||
      !Number.isFinite(ttsStorageMax) ||
      ttsStorageMax < 1
    ) {
      return { error: `Tarif „${tier}“: ungültige Limits` };
    }
    result[tier] = {
      llmBudgetCents,
      llmPerHour,
      ttsPerHour,
      ttsStorageMax,
    };
  }
  return result;
}

type AdminLogEvent = {
  id: string;
  kind: string;
  label: string | null;
  costLabel: string;
  createdAt: string;
};

type BillingSettingsState = {
  usdToEurRate: number;
  ttsUsdPer1kFlash: number;
  ttsUsdPer1kStandard: number;
  eurPer1kFlashHint?: string;
  eurPer1kStandardHint?: string;
  updatedAt: string | null;
};

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [periodMonth, setPeriodMonth] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [log, setLog] = useState<AdminLogEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState<BillingSettingsState | null>(null);
  const [billingDraft, setBillingDraft] = useState({
    usdToEur: "",
    ttsUsdFlash: "",
    ttsUsdStandard: "",
  });
  const [billingWarning, setBillingWarning] = useState<string | null>(null);
  const [pricingUrl, setPricingUrl] = useState(
    "https://elevenlabs.io/pricing/api",
  );
  const [starterNote, setStarterNote] = useState<string | null>(null);
  const [tierLimits, setTierLimits] = useState<TierLimitsMap | null>(null);
  const [tierLimitsDraft, setTierLimitsDraft] = useState<
    Record<UserTier, Record<keyof TierLimitDefaults, string>> | null
  >(null);
  const [creditEur, setCreditEur] = useState("5");
  const [creditNote, setCreditNote] = useState("");

  const loadBilling = useCallback(async () => {
    const res = await authFetch("/api/admin/billing-settings");
    if (!res.ok) return;
    const json = (await res.json()) as {
      settings: BillingSettingsState;
      tierLimits?: TierLimitsMap;
      warning?: string;
      pricingUrl?: string;
      starterPlanNote?: string;
    };
    setBilling(json.settings);
    setBillingDraft({
      usdToEur: String(json.settings.usdToEurRate),
      ttsUsdFlash: String(json.settings.ttsUsdPer1kFlash),
      ttsUsdStandard: String(json.settings.ttsUsdPer1kStandard),
    });
    setBillingWarning(json.warning ?? null);
    if (json.pricingUrl) setPricingUrl(json.pricingUrl);
    setStarterNote(json.starterPlanNote ?? null);
    if (json.tierLimits) {
      setTierLimits(json.tierLimits);
      setTierLimitsDraft(draftFromTierLimits(json.tierLimits));
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await authFetch("/api/admin/users");
    if (res.status === 403 || res.status === 401) {
      setAllowed(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error ?? `Fehler ${res.status}`);
      setAllowed(true);
      return;
    }
    setAllowed(true);
    const json = (await res.json()) as {
      users: AdminUser[];
      periodMonth: string;
    };
    setUsers(json.users);
    setPeriodMonth(json.periodMonth);
  }, []);

  const loadLog = useCallback(async (userId: string) => {
    const res = await authFetch(
      `/api/admin/usage-log?userId=${encodeURIComponent(userId)}&limit=50`,
    );
    if (!res.ok) return;
    const json = (await res.json()) as { events: AdminLogEvent[] };
    setLog(json.events);
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadBilling();
  }, [loadUsers, loadBilling]);

  useEffect(() => {
    if (selectedId) void loadLog(selectedId);
    else setLog([]);
    setCreditEur("5");
    setCreditNote("");
  }, [selectedId, loadLog]);

  const saveBilling = async () => {
    const usdToEurRate = Number.parseFloat(billingDraft.usdToEur.replace(",", "."));
    const ttsUsdPer1kFlash = Number.parseFloat(
      billingDraft.ttsUsdFlash.replace(",", "."),
    );
    const ttsUsdPer1kStandard = Number.parseFloat(
      billingDraft.ttsUsdStandard.replace(",", "."),
    );
    if (!Number.isFinite(usdToEurRate) || usdToEurRate <= 0 || usdToEurRate > 5) {
      setMessage("USD→EUR muss zwischen 0 und 5 liegen.");
      return;
    }
    if (!Number.isFinite(ttsUsdPer1kFlash) || ttsUsdPer1kFlash < 0) {
      setMessage("TTS Flash $/1k ungültig.");
      return;
    }
    if (!Number.isFinite(ttsUsdPer1kStandard) || ttsUsdPer1kStandard < 0) {
      setMessage("TTS Multilingual/v3 $/1k ungültig.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/billing-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usdToEurRate,
          ttsUsdPer1kFlash,
          ttsUsdPer1kStandard,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Speichern fehlgeschlagen (${res.status})`);
      }
      setMessage("Kurse gespeichert.");
      await loadBilling();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveTierLimits = async () => {
    if (!tierLimitsDraft) return;
    const parsed = parseTierLimitsDraft(tierLimitsDraft);
    if ("error" in parsed) {
      setMessage(parsed.error);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/billing-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierLimits: parsed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Speichern fehlgeschlagen (${res.status})`);
      }
      setMessage("Tarif-Limits gespeichert.");
      await loadBilling();
      await loadUsers();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const resetLlmMonth = async (userId: string) => {
    if (
      !window.confirm(
        `LLM-Verbrauch für ${periodMonth} wirklich zurücksetzen? Der Nutzer startet den Monat bei 0 €.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/reset-llm-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, periodMonth }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Reset fehlgeschlagen (${res.status})`);
      }
      const body = (await res.json()) as { message?: string };
      setMessage(body.message ?? "LLM-Monat zurückgesetzt.");
      await loadUsers();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveTier = async (userId: string, tier: UserTier) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Speichern fehlgeschlagen (${res.status})`);
      }
      const body = (await res.json()) as { betaWelcomeGranted?: boolean };
      setMessage(
        body.betaWelcomeGranted
          ? `Tarif ${tier} gespeichert — Beta-Startguthaben (5 €) gutgeschrieben.`
          : `Tarif ${tier} gespeichert.`,
      );
      await loadUsers();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const grantWalletCredit = async (userId: string) => {
    const amountEur = Number.parseFloat(creditEur.replace(",", "."));
    if (!Number.isFinite(amountEur) || amountEur < 0.01) {
      setMessage("Guthaben: mindestens 0,01 € eingeben.");
      return;
    }
    if (amountEur > 500) {
      setMessage("Guthaben: maximal 500 € pro Gutschrift.");
      return;
    }
    const label = users.find((u) => u.userId === userId)?.email ?? userId.slice(0, 8);
    if (
      !window.confirm(
        `${amountEur.toFixed(2)} € an ${label} gutschreiben?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/wallet-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          amountEur,
          description: creditNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Gutschrift fehlgeschlagen (${res.status})`);
      }
      const body = (await res.json()) as {
        creditedEur?: string;
        walletBalanceEur?: string;
      };
      setMessage(
        `Guthaben gutgeschrieben: +${body.creditedEur ?? ""} · neuer Stand ${body.walletBalanceEur ?? ""}.`,
      );
      setCreditNote("");
      await loadUsers();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const selectedUser = selectedId
    ? users.find((u) => u.userId === selectedId) ?? null
    : null;

  if (allowed === false) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader title="Admin" backHref="/" />
        <p className="p-6 text-sm text-zinc-400">
          Kein Zugriff. Setze deine User-UUID in{" "}
          <code className="text-accent">ADMIN_USER_IDS</code> (Vercel) und
          melde dich neu an.
        </p>
        <Link href="/account" className="px-6 text-sm text-accent underline">
          Zurück zum Account
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Admin" backHref="/account" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
        <p className="text-sm text-zinc-400">
          Beta-Verwaltung: Tarife setzen, Verbrauch einsehen. Monat{" "}
          {periodMonth || "…"} · Service Role +{" "}
          <code className="text-accent">ADMIN_USER_IDS</code> nötig.
        </p>

        {message ? (
          <p className="text-sm text-amber-200/90">{message}</p>
        ) : null}

        {allowed === null ? (
          <p className="text-sm text-zinc-500">Prüfe Berechtigung…</p>
        ) : (
          <>
          <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h2 className="mb-1 text-sm font-medium text-accent">
              Abrechnungskurse
            </h2>
            <p className="mb-2 text-xs text-zinc-500">
              OpenRouter-USD → EUR für LLM. TTS nach{" "}
              <a
                href={pricingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                Eleven API-Preisliste
              </a>
              : Flash/Turbo $0,05 · Multilingual/v3 $0,10 pro 1k Zeichen
              (Defaults).
            </p>
            {starterNote ? (
              <p className="mb-3 text-xs text-zinc-600">{starterNote}</p>
            ) : null}
            {billingWarning ? (
              <p className="mb-2 text-xs text-amber-300">{billingWarning}</p>
            ) : null}
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                USD → EUR
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={busy}
                  value={billingDraft.usdToEur}
                  onChange={(e) =>
                    setBillingDraft((d) => ({
                      ...d,
                      usdToEur: e.target.value,
                    }))
                  }
                  className="w-28 rounded border border-surface-border bg-surface px-2 py-1.5 text-zinc-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                TTS Flash $/1k
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={busy}
                  value={billingDraft.ttsUsdFlash}
                  onChange={(e) =>
                    setBillingDraft((d) => ({
                      ...d,
                      ttsUsdFlash: e.target.value,
                    }))
                  }
                  className="w-24 rounded border border-surface-border bg-surface px-2 py-1.5 text-zinc-200"
                />
                {billing?.eurPer1kFlashHint ? (
                  <span className="text-[10px] text-zinc-600">
                    ≈ {billing.eurPer1kFlashHint}/1k
                  </span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                TTS Multilingual/v3 $/1k
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={busy}
                  value={billingDraft.ttsUsdStandard}
                  onChange={(e) =>
                    setBillingDraft((d) => ({
                      ...d,
                      ttsUsdStandard: e.target.value,
                    }))
                  }
                  className="w-24 rounded border border-surface-border bg-surface px-2 py-1.5 text-zinc-200"
                />
                {billing?.eurPer1kStandardHint ? (
                  <span className="text-[10px] text-zinc-600">
                    ≈ {billing.eurPer1kStandardHint}/1k
                  </span>
                ) : null}
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveBilling()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
              >
                Kurse speichern
              </button>
            </div>
            {billing?.updatedAt ? (
              <p className="mt-2 text-[10px] text-zinc-600">
                Zuletzt:{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(billing.updatedAt))}
              </p>
            ) : null}
          </section>

          {tierLimitsDraft ? (
            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-1 text-sm font-medium text-accent">
                Tarif-Limits (Standard)
              </h2>
              <p className="mb-3 text-xs text-zinc-500">
                Gilt für alle Nutzer ohne Profil-Override. Werte in Cent (LLM
                Monatsbudget), Stunden-Limits und max. TTS-Speicher (Anzahl).
                Env-Defaults werden überschrieben, sobald gespeichert.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="px-2 py-1">Tarif</th>
                      <th className="px-2 py-1">LLM Monat (ct)</th>
                      <th className="px-2 py-1">LLM /h</th>
                      <th className="px-2 py-1">TTS /h</th>
                      <th className="px-2 py-1">TTS Storage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map((tier) => (
                      <tr
                        key={tier}
                        className="border-t border-surface-border/50"
                      >
                        <td className="px-2 py-1.5 font-medium text-zinc-300">
                          {tier}
                        </td>
                        {(
                          [
                            "llmBudgetCents",
                            "llmPerHour",
                            "ttsPerHour",
                            "ttsStorageMax",
                          ] as const
                        ).map((field) => (
                          <td key={field} className="px-2 py-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={busy}
                              value={tierLimitsDraft[tier][field]}
                              onChange={(e) =>
                                setTierLimitsDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        [tier]: {
                                          ...d[tier],
                                          [field]: e.target.value,
                                        },
                                      }
                                    : d,
                                )
                              }
                              className="w-20 rounded border border-surface-border bg-surface px-1.5 py-1 text-zinc-200"
                            />
                            {field === "llmBudgetCents" && tierLimits ? (
                              <span className="ml-1 text-[10px] text-zinc-600">
                                ≈{" "}
                                {formatEur(
                                  Number.parseInt(
                                    tierLimitsDraft[tier].llmBudgetCents,
                                    10,
                                  ) || tierLimits[tier].llmBudgetCents,
                                )}
                              </span>
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={busy || !!billingWarning}
                onClick={() => void saveTierLimits()}
                className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
              >
                Tarif-Limits speichern
              </button>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-surface-border bg-surface-raised p-3">
              <h2 className="mb-2 text-sm font-medium text-accent">Nutzer</h2>
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="px-2 py-1">E-Mail</th>
                      <th className="px-2 py-1">Tarif</th>
                      <th className="px-2 py-1 text-right">Guthaben</th>
                      <th className="px-2 py-1 text-right">LLM Monat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.userId}
                        className={`cursor-pointer border-t border-surface-border/50 ${
                          selectedId === u.userId ? "bg-accent/10" : ""
                        }`}
                        onClick={() => setSelectedId(u.userId)}
                      >
                        <td className="max-w-[10rem] truncate px-2 py-1.5">
                          {u.email ?? u.userId.slice(0, 8) + "…"}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={u.tier}
                            disabled={busy}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              void saveTier(
                                u.userId,
                                e.target.value as UserTier,
                              )
                            }
                            className="rounded border border-surface-border bg-surface px-1 py-0.5 text-zinc-200"
                          >
                            <option value="free">free</option>
                            <option value="beta">beta</option>
                            <option value="pro">pro</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right text-zinc-300">
                          {formatEur(u.walletBalanceCents ?? 0)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">
                          {formatEur(u.usage.costCents)}
                          <span className="text-zinc-600">
                            {" "}
                            / {formatEur(u.limits.llmBudgetCents)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-accent">
                  Protokoll
                  {selectedId ? (
                    <span className="ml-1 font-normal text-zinc-500">
                      ({selectedId.slice(0, 8)}…)
                    </span>
                  ) : null}
                </h2>
                {selectedId ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resetLlmMonth(selectedId)}
                    className="rounded-lg border border-amber-500/40 px-2 py-1 text-xs text-amber-200/90 disabled:opacity-50"
                  >
                    LLM-Monat zurücksetzen ({periodMonth})
                  </button>
                ) : null}
              </div>

              {selectedUser ? (
                <div className="mb-3 rounded-lg border border-surface-border/60 bg-surface p-3">
                  <h3 className="text-xs font-medium text-accent">
                    Guthaben gutschreiben
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Wallet-Stand:{" "}
                    <span className="text-zinc-300">
                      {formatEur(selectedUser.walletBalanceCents ?? 0)}
                    </span>
                    {selectedUser.tier === "free" ? (
                      <span className="text-zinc-600">
                        {" "}
                        (+ 2 €/Woche Gratis, siehe Account)
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Betrag (€)
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={busy}
                        value={creditEur}
                        onChange={(e) => setCreditEur(e.target.value)}
                        className="w-24 rounded border border-surface-border bg-surface-raised px-2 py-1.5 text-zinc-200"
                      />
                    </label>
                    <label className="min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-400 sm:flex">
                      Notiz (optional)
                      <input
                        type="text"
                        disabled={busy}
                        value={creditNote}
                        onChange={(e) => setCreditNote(e.target.value)}
                        placeholder="z. B. Beta-Tester Bonus"
                        className="rounded border border-surface-border bg-surface-raised px-2 py-1.5 text-zinc-200"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void grantWalletCredit(selectedUser.userId)}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
                    >
                      Gutschreiben
                    </button>
                  </div>
                </div>
              ) : null}

              {!selectedId ? (
                <p className="text-xs text-zinc-500">
                  Nutzer in der Liste auswählen.
                </p>
              ) : log.length === 0 ? (
                <p className="text-xs text-zinc-500">Keine Einträge.</p>
              ) : (
                <ul className="max-h-[28rem] space-y-1 overflow-y-auto text-xs">
                  {log.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded border border-surface-border/50 px-2 py-1 text-zinc-300"
                    >
                      <span className="text-zinc-500">
                        {ev.kind.toUpperCase()}
                      </span>{" "}
                      {ev.label ?? "—"} · {ev.costLabel}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            void loadUsers();
            void loadBilling();
            if (selectedId) void loadLog(selectedId);
          }}
          className="self-start text-sm text-accent underline"
        >
          Daten neu laden
        </button>
      </div>
    </main>
  );
}
