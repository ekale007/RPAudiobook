"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/errors";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

export default function UpdatePasswordPage() {
  const { t } = useUiLocale();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        return;
      }
      setError(t("auth.resetLinkExpired"));
    });
  }, [t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("auth.passwordMin"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={t("auth.updatePasswordTitle")} backHref="/login" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-sm text-zinc-400">{t("auth.updatePasswordHint")}</p>

        {ready ? (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-sm text-zinc-400">{t("auth.newPassword")}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
              autoComplete="new-password"
            />
            <label className="text-sm text-zinc-400">
              {t("auth.confirmPassword")}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-accent py-3 text-base font-medium text-black disabled:opacity-50"
            >
              {busy ? t("auth.saving") : t("auth.savePassword")}
            </button>
          </form>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </main>
  );
}
