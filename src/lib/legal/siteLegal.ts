/**
 * Legal identity for HörbuchKI (override via .env.local if needed).
 * @see https://www.gesetze-im-internet.de/ddg/__5.html (Impressum)
 */
export const siteLegal = {
  productName: "HörbuchKI",
  operatorName:
    process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() || "Eyüp Kale",
  contactEmail:
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "eyuepkale@gmail.com",
  /** Optional full postal address — omitted in UI when empty */
  postalAddress: process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim() || "",
  country: "Deutschland",
  serviceDescription:
    "Interaktive Story-App im Browser mit KI-Texten und optionaler Sprachausgabe (geschlossene Beta).",
  lastUpdated: "3. Juni 2026",
  /** Production URL for legal references */
  websiteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://rp-audiobook.vercel.app",
} as const;

export const thirdPartyLegal = {
  supabase: "https://supabase.com/privacy",
  vercel: "https://vercel.com/legal/privacy-policy",
  openrouter: "https://openrouter.ai/privacy",
  elevenlabs: "https://elevenlabs.io/privacy",
} as const;
