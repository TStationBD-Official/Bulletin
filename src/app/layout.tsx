import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import ConditionalHeader from "@/components/ConditionalHeader";
import ConditionalFooter from "@/components/ConditionalFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Net Chronicle | Share & Discuss",
  description:
    "The Net Chronicle — a social blogging platform for education. Share posts, engage with the community, and discuss educational topics.",
  keywords: [
    "education",
    "blog",
    "community",
    "tutoring",
    "learning",
    "the net chronicle",
  ],
};

function ThemeInitializer() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          try {
            const raw = localStorage.getItem('theme-storage');
            const state = raw ? JSON.parse(raw)?.state : null;
            const theme = state?.theme ?? 'auto';
            const accent = state?.accent ?? 'blue';
            const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (isDark) document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-accent', accent);
          } catch (e) {}
        `,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Monetag multitag (verified) */}
        <script src="https://quge5.com/88/tag.min.js" data-zone="263152" async data-cfasync="false"></script>
        {/* Adsterra Popunder — must stay right before </head>, one per page per Adsterra's guidance */}
        <script src="https://pl30509826.effectivecpmnetwork.com/b9/61/59/b96159b813a6345c50f192c2d7b48a52.js"></script>
        <ThemeInitializer />
      </head>
      <body className={`${inter.className} bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-primary antialiased transition-colors`}>
        {/* Google Identity Services — required for silent Drive access-token
            refresh (see src/lib/driveAuth.ts). Without this script loaded,
            window.google.accounts.oauth2 never exists and every silent
            refresh attempt fails immediately, forcing a real interactive
            "Reconnect" popup every ~60 minutes instead. */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        {/* Yandex Ads Autoplacement 19611424 */}
        <Script src="https://yandex.ru/ads/system/context.js" strategy="afterInteractive" async />
        <Script
          data-page-id="19611424"
          src="https://yandex.ru/ads/system/ap-loader.js"
          strategy="afterInteractive"
          async
        />
        {/* Adsterra Social Bar — self-positioning floating widget, loaded once site-wide */}
        <Script
          src="https://pl30509829.effectivecpmnetwork.com/04/9e/9d/049e9d975be3d4b685a9c5ea30d32cdd.js"
          strategy="afterInteractive"
        />
        <Providers>
          <ConditionalHeader />
          {children}
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
