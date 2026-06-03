"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LlmUsagePanel } from "@/components/LlmUsagePanel";
import { authFetch } from "@/lib/supabase/authFetch";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/errors";
import { isInviteOnlyBeta } from "@/lib/auth/betaAuth";

type AccountPayload = {
  email: string | null;
  tier: string;
  tierLabel: string;
  limits: {
    llmBudgetEur: string;
    llmPerHour: number;
    ttsPerHour: number;
    ttsStorageMax: number;
    modelRestricted: boolean;
  };
  ttsCloud: { used: number; max: number; remaining: number };
  monthlyWarning?: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [data, setData] = useState<AccountPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inviteOnly = isInviteOnlyBeta();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/account");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Account (${res.status})`);
      }
      setData((await res.json()) as AccountPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void load();
  }, [load]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title="Account" backHref="/" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
        {loading ? (
          <p className="text-sm text-zinc-500">Lade Account…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : data ? (
          <>
            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="font-medium text-accent">Profil</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">E-Mail</dt>
                  <dd className="truncate text-zinc-200">{data.email ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Tarif</dt>
                  <dd className="font-medium text-accent">{data.tierLabel}</dd>
                </div>
              </dl>
              {inviteOnly ? (
                <p className="mt-3 text-xs text-zinc-500">
                  Beta — Zugang per Einladung. Tarif-Upgrade nur durch Admin.
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="font-medium text-accent">Limits (dieser Tarif)</h2>
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                <li>LLM-Monatsbudget: {data.limits.llmBudgetEur}</li>
                <li>LLM: {data.limits.llmPerHour} Anfragen / Stunde</li>
                <li>TTS: {data.limits.ttsPerHour} Anfragen / Stunde</li>
                <li>
                  Cloud-Audio: {data.ttsCloud.used} / {data.ttsCloud.max}{" "}
                  gespeichert
                </li>
              </ul>
              {data.limits.modelRestricted ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  Free-Tier: nur günstige Flash-Modelle im LLM-Picker.
                </p>
              ) : null}
              {data.monthlyWarning ? (
                <p className="mt-2 text-xs text-amber-300">
                  {data.monthlyWarning}
                </p>
              ) : null}
            </section>

            <LlmUsagePanel />

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-3 font-medium text-accent">Sicherheit</h2>
              <div className="flex flex-col gap-2">
                <Link
                  href="/auth/update-password"
                  className="rounded-lg border border-surface-border px-4 py-2.5 text-center text-sm text-zinc-200 hover:border-accent/40"
                >
                  Passwort ändern
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-lg border border-surface-border px-4 py-2.5 text-sm text-zinc-300 hover:border-red-400/40 hover:text-red-300"
                >
                  Abmelden
                </button>
              </div>
            </section>

            <p className="text-center text-xs text-zinc-600">
              Technische Einstellungen (Stimmen, Modelle):{" "}
              <Link href="/settings" className="text-accent underline">
                Settings
              </Link>
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
