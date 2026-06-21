import { brand } from "@/lib/brand";

/**
 * Legal identity — set NEXT_PUBLIC_LEGAL_* in env for hosted deployments (Impressum).
 * Local/OSS defaults are placeholders only.
 * @see https://www.gesetze-im-internet.de/ddg/__5.html (Impressum)
 */
export const siteLegal = {
  productName: brand.productName,
  operatorName:
    process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() || "Not configured",
  contactEmail:
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "contact@example.com",
  /** Optional full postal address — omitted in UI when empty */
  postalAddress: process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim() || "",
  country: "Deutschland",
  serviceDescription:
    "Interaktive Rollenspiel-Geschichten im Browser mit KI-Erzähler und optionaler Sprachausgabe (geschlossener Test).",
  lastUpdated: "3. Juni 2026",
  /** Production URL for legal references */
  websiteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    brand.defaultSiteUrl,
} as const;

export const thirdPartyLegal = {
  supabase: "https://supabase.com/privacy",
  vercel: "https://vercel.com/legal/privacy-policy",
  openrouter: "https://openrouter.ai/privacy",
  elevenlabs: "https://elevenlabs.io/privacy",
} as const;
