import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import "@/lib/initCloudSync";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { RTL_LOCALES } from "@/i18n/config";
import { getSettings } from "@/lib/db/settings";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata() {
  const settings = await getSettings();
  const instanceName = settings?.instanceName || "Zavorth";
  const customFaviconUrl = settings?.customFaviconUrl || settings?.customFaviconBase64;

  return {
    title: `${instanceName} - Control Plane`,
    description:
      "Zavorth coordinates providers, auth, budgets, and tool access from a single operator control plane.",
    icons: {
      icon: customFaviconUrl ? "/api/settings/favicon" : "/favicon.svg",
      apple: "/apple-touch-icon.svg",
    },
  };
}

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const isRtl = RTL_LOCALES.includes(locale as (typeof RTL_LOCALES)[number]);

  return (
    <html lang={locale} dir={isRtl ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${ibmPlexSans.className} antialiased`} suppressHydrationWarning>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/[0.12] blur-3xl dark:bg-primary/[0.18]" />
          <div className="absolute -right-12 bottom-0 h-80 w-80 rounded-full bg-accent/[0.10] blur-3xl dark:bg-accent/[0.14]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
        >
          Skip to content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <div className="relative min-h-screen">{children}</div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
