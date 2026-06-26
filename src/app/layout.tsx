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
  title: brand.productName,
  description: brand.tagline,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.shortName,
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
