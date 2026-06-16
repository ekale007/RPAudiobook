import type { Metadata, Viewport } from "next";
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
  themeColor: "#0f0f12",
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
      <body className="min-h-dvh antialiased">
        <PwaBootstrap />
        <ServerCapabilitiesBootstrap />
        <UserPreferencesBootstrap />
        <UiLocaleProvider>
          {children}
          <PwaInstallBanner />
        </UiLocaleProvider>
      </body>
    </html>
  );
}
