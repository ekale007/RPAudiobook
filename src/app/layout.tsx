import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { ServerCapabilitiesBootstrap } from "@/components/ServerCapabilitiesBootstrap";
import { UserPreferencesBootstrap } from "@/components/UserPreferencesBootstrap";
import { brand } from "@/lib/brand";
import { UiLocaleProvider } from "@/lib/i18n/UiLocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: brand.productName,
    template: `%s — ${brand.productName}`,
  },
  description: brand.tagline,
  applicationName: brand.productName,
  keywords: [
    "interactive fiction",
    "audiobook",
    "AI storytelling",
    "roleplay",
    "text-to-speech",
    "TTS",
    "Hörbuch",
    "RPG",
    "ElevenLabs",
    "ElevenLabs alternative",
  ],
  authors: [{ name: "eKale" }],
  creator: "eKale",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.shortName,
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    alternateLocale: ["en_US"],
    url: "https://rp-audiobook.vercel.app",
    siteName: brand.productName,
    title: brand.productName,
    description: brand.tagline,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${brand.productName} — ${brand.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: brand.productName,
    description: brand.tagline,
    images: ["/og-image.png"],
    creator: "@ekale007",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://rp-audiobook.vercel.app",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0c0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="icon" href={brand.logoSrc} type="image/png" />
        <link rel="apple-touch-icon" href={brand.logoSrc} />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-dvh bg-surface font-sans antialiased text-zinc-100`}
      >
        <PwaBootstrap />
        <ServerCapabilitiesBootstrap />
        <UserPreferencesBootstrap />
        <UiLocaleProvider>
          {children}
          <PwaInstallBanner />
        </UiLocaleProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
