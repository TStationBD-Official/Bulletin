import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import ConditionalHeader from "@/components/ConditionalHeader";
import ConditionalFooter from "@/components/ConditionalFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bulletin | Share & Discuss",
  description:
    "Bulletin — a social blogging platform for education. Share posts, engage with the community, and discuss educational topics.",
  keywords: [
    "education",
    "blog",
    "community",
    "tutoring",
    "learning",
    "bulletin",
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
        <Providers>
          <ConditionalHeader />
          {children}
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
