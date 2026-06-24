import type { Provider } from "@supabase/supabase-js";

export type OAuthProviderId = Extract<
  Provider,
  "google" | "github" | "discord" | "apple" | "azure"
>;

export type OAuthProviderDef = {
  id: OAuthProviderId;
  labelKey: `oauth.${OAuthProviderId}`;
};

const OAUTH_PROVIDER_CATALOG: OAuthProviderDef[] = [
  { id: "google", labelKey: "oauth.google" },
  { id: "github", labelKey: "oauth.github" },
  { id: "discord", labelKey: "oauth.discord" },
  { id: "apple", labelKey: "oauth.apple" },
  { id: "azure", labelKey: "oauth.azure" },
];

const CATALOG_IDS = new Set(
  OAUTH_PROVIDER_CATALOG.map((p) => p.id),
);

function parseOAuthProviderId(raw: string): OAuthProviderId | null {
  const id = raw.trim().toLowerCase();
  return CATALOG_IDS.has(id as OAuthProviderId)
    ? (id as OAuthProviderId)
    : null;
}

/** Comma-separated via NEXT_PUBLIC_OAUTH_PROVIDERS; default: google, github, discord. */
export function getEnabledOAuthProviders(): OAuthProviderDef[] {
  const raw = process.env.NEXT_PUBLIC_OAUTH_PROVIDERS?.trim();
  const ids =
    raw === ""
      ? []
      : (raw ?? "google,github,discord")
          .split(",")
          .map(parseOAuthProviderId)
          .filter((id): id is OAuthProviderId => id != null);

  const unique = [...new Set(ids)];
  return OAUTH_PROVIDER_CATALOG.filter((p) => unique.includes(p.id));
}
