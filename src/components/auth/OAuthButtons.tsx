"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/errors";
import { getAuthCallbackUrl } from "@/lib/auth/redirectUrl";
import {
  getEnabledOAuthProviders,
  type OAuthProviderDef,
  type OAuthProviderId,
} from "@/lib/auth/oauthProviders";
import { useUiLocale } from "@/lib/i18n/UiLocaleProvider";

function ProviderIcon({ id }: { id: OAuthProviderId }) {
  switch (id) {
    case "google":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.303-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.236-3.22-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.8c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.479 5.92.43.37.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .32.216.694.825.576C20.565 21.796 24 17.297 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      );
    case "discord":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#5865F2]" aria-hidden>
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    case "apple":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      );
    case "azure":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#F25022" d="M1 1h10v10H1z" />
          <path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" />
          <path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
      );
  }
}

function OAuthButton({
  provider,
  disabled,
  busy,
  onClick,
}: {
  provider: OAuthProviderDef;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const { t } = useUiLocale();

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-raised py-3 text-sm font-medium text-zinc-100 transition hover:border-accent/40 disabled:opacity-50"
    >
      <ProviderIcon id={provider.id} />
      {t("login.continueWith", { provider: t(provider.labelKey) })}
    </button>
  );
}

export function OAuthButtons({
  disabled = false,
  onError,
}: {
  disabled?: boolean;
  onError: (message: string | null) => void;
}) {
  const { locale } = useUiLocale();
  const providers = getEnabledOAuthProviders();
  const [busyId, setBusyId] = useState<OAuthProviderId | null>(null);

  if (!providers.length) return null;

  const signInWithProvider = async (provider: OAuthProviderDef) => {
    onError(null);
    setBusyId(provider.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider.id,
        options: { redirectTo: getAuthCallbackUrl() },
      });
      if (error) throw error;
    } catch (err) {
      onError(formatAuthError(err, locale));
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <OAuthButton
          key={provider.id}
          provider={provider}
          disabled={disabled}
          busy={busyId === provider.id}
          onClick={() => void signInWithProvider(provider)}
        />
      ))}
    </div>
  );
}

export function OAuthDivider() {
  const { t } = useUiLocale();
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-surface-border" />
      <span className="text-xs text-zinc-500">{t("login.oauthOr")}</span>
      <div className="h-px flex-1 bg-surface-border" />
    </div>
  );
}
