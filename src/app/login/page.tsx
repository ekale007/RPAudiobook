"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LocalModeRedirect } from "@/components/LocalModeRedirect";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/errors";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";
import {
  getPasswordResetRedirectUrl,
  isLocalhostOrigin,
  loadRedirectOriginOverride,
  saveRedirectOriginOverride,
  getAuthRedirectOrigin,
} from "@/lib/auth/redirectUrl";
import {
  isInviteOnlyBeta,
  showAnonymousDevLogin,
} from "@/lib/auth/betaAuth";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";

type LoginView = "sign-in" | "forgot-password";

function LoginForm() {
  const { t, locale } = useUiLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<LoginView>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [originOverride, setOriginOverride] = useState("");
  const inviteOnly = isInviteOnlyBeta();
  const showAnonymous = showAnonymousDevLogin();

  useEffect(() => {
    setOriginOverride(loadRedirectOriginOverride());
    const err = searchParams.get("error");
    if (err) setError(decodeURIComponent(err));
    if (searchParams.get("reset") === "sent") {
      setInfo(t("login.resetParamSent"));
    }
  }, [searchParams, t]);

  const signInPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(formatAuthError(err, locale));
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setResetSent(false);

    saveRedirectOriginOverride(originOverride);
    const origin = getAuthRedirectOrigin();

    if (isLocalhostOrigin(origin)) {
      setError(t("login.redirectLocalhost"));
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: getPasswordResetRedirectUrl() },
      );
      if (err) throw err;
      setResetSent(true);
      setInfo(t("login.resetSent"));
    } catch (err) {
      setError(formatAuthError(err, locale));
    } finally {
      setBusy(false);
    }
  };

  const signInAnonymous = async () => {
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInAnonymously();
      if (err) throw err;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        `${formatAuthError(err, locale)} ${t("authErrors.anonymousHint")}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
      <div className="flex flex-1 flex-col gap-3 p-4">
      {view === "sign-in" ? (
        <form onSubmit={signInPassword} className="flex flex-col gap-3">
          {inviteOnly ? (
            <>
              <p className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs leading-relaxed text-violet-200">
                {t("login.betaPitch")}
              </p>
              <p className="rounded-lg border border-surface-border bg-surface-raised/40 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                <strong className="text-zinc-300">Keinen Invite?</strong>{" "}
                Trag dich auf die{" "}
                <a
                  href="/waitlist"
                  className="text-accent underline hover:text-accent/80"
                >
                  Warteliste
                </a>{" "}
                ein. Wir öffnen die Beta schrittweise.
              </p>
            </>
          ) : (
            <p className="text-xs text-zinc-500">{t("login.signInPitch")}</p>
          )}
          <OAuthButtons
            disabled={busy}
            onError={(message) => {
              setInfo(null);
              setError(message);
            }}
          />
          <OAuthDivider />
          <label className="text-sm text-zinc-400">{t("login.email")}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface-raised/90 px-2.5 py-2 text-sm"
            autoComplete="email"
          />
          <label className="text-sm text-zinc-400">{t("login.password")}</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface-raised/90 px-2.5 py-2 text-sm"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => {
              setView("forgot-password");
              setError(null);
              setInfo(null);
            }}
            className="self-start text-xs text-accent underline"
          >
            {t("login.forgot")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {t("login.signIn")}
          </button>
          {!inviteOnly ? (
            <p className="text-center text-sm text-zinc-500">
              {t("login.noAccount")}{" "}
              <Link href="/signup" className="text-accent underline">
                {t("login.goSignUp")}
              </Link>
            </p>
          ) : null}
        </form>
      ) : (
        <form onSubmit={sendPasswordReset} className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">{t("login.resetPitch")}</p>
          <button
            type="button"
            onClick={() => {
              setView("sign-in");
              setError(null);
              setResetSent(false);
            }}
            className="self-start text-xs text-zinc-500 underline"
          >
            {t("login.backToSignIn")}
          </button>
          <label className="text-sm text-zinc-400">{t("login.appUrlLabel")}</label>
          <input
            value={originOverride}
            onChange={(e) => setOriginOverride(e.target.value)}
            className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm"
            placeholder="http://192.168.1.42:3000"
          />
          <p className="text-xs text-zinc-600">
            {t("login.resetRedirect")}{" "}
            <span className="break-all font-mono text-zinc-500">
              {typeof window !== "undefined"
                ? getPasswordResetRedirectUrl()
                : "…"}
            </span>
          </p>
          <label className="text-sm text-zinc-400">{t("login.email")}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface-raised/90 px-2.5 py-2 text-sm"
            autoComplete="email"
            disabled={resetSent}
          />
          {!resetSent ? (
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {t("login.sendResetLink")}
            </button>
          ) : null}
        </form>
      )}

      {showAnonymous ? (
        <div className="border-t border-surface-border pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={signInAnonymous}
            className="w-full rounded-xl border border-dashed border-zinc-600 py-2 text-xs text-zinc-500"
          >
            {t("login.devAnonymous")}
          </button>
          <p className="mt-2 text-center text-xs text-zinc-600">
            {t("login.devAnonymousHint")}
          </p>
        </div>
      ) : null}

      {info ? <p className="text-sm text-green-400">{info}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

function LoginPageContent() {
  const { t } = useUiLocale();

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader title={t("login.title")} backHref="/" />
      <Suspense
        fallback={
          <p className="p-6 text-center text-zinc-500">{t("login.loading")}</p>
        }
      >
        <LoginForm />
      </Suspense>
      <LegalFooter className="mt-auto" />
    </main>
  );
}

export default function LoginPage() {
  return (
    <LocalModeRedirect>
      <LoginPageContent />
    </LocalModeRedirect>
  );
}
