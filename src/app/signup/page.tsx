"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/errors";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import { isInviteOnlyBeta } from "@/lib/auth/betaAuth";
import { LocalModeRedirect } from "@/components/LocalModeRedirect";

function SignUpPageContent() {
  const { t, locale } = useUiLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inviteOnly = isInviteOnlyBeta();

  const signUpPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) {
      setError(t("login.passwordMin"));
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
      setInfo(t("login.accountCreated"));
    } catch (err) {
      setError(formatAuthError(err, locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={t("signup.title")} backHref="/" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        {inviteOnly ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs leading-relaxed text-violet-200">
              {t("signup.inviteOnlyPitch")}
            </p>
            <Link
              href="/login"
              className="rounded-xl bg-accent py-3 text-center text-base font-medium text-black"
            >
              {t("signup.goSignIn")}
            </Link>
          </div>
        ) : (
          <form onSubmit={signUpPassword} className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500">{t("signup.pitch")}</p>
            <label className="text-sm text-zinc-400">{t("login.email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
              autoComplete="email"
            />
            <label className="text-sm text-zinc-400">{t("login.password")}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-base"
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-accent py-3 text-base font-medium text-black disabled:opacity-50"
            >
              {t("signup.submit")}
            </button>
            <p className="text-center text-sm text-zinc-500">
              {t("signup.hasAccount")}{" "}
              <Link href="/login" className="text-accent underline">
                {t("signup.goSignIn")}
              </Link>
            </p>
          </form>
        )}

        {info ? <p className="text-sm text-green-400">{info}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
      <LegalFooter className="mt-auto" />
    </main>
  );
}

export default function SignUpPage() {
  return (
    <LocalModeRedirect>
      <SignUpPageContent />
    </LocalModeRedirect>
  );
}
