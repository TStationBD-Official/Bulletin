"use client";

import Link from "next/link";
import { useStore } from "@/store/useStore";
import Logo from "./Logo";

export default function Footer() {
  const { settings } = useStore();
  const description = settings?.siteDescription ?? "Share and discuss educational content";
  const siteTitle   = settings?.siteTitle ?? "Bulletin";

  const policies = [
    { href: "/terms",      label: "Terms",      content: settings?.termsOfService      },
    { href: "/privacy",    label: "Privacy",    content: settings?.privacyPolicy       },
    { href: "/guidelines", label: "Guidelines", content: settings?.communityGuidelines },
  ].filter((p) => !!p.content?.trim());

  return (
    <footer className="border-t border-gray-100 dark:border-dark-border bg-white dark:bg-dark-bg mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex flex-col gap-2">
            <Logo size={32} showName />
            {description && (
              <p className="text-[12px] text-gray-400 dark:text-dark-tertiary max-w-xs leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Right: links + copyright */}
          <div className="flex flex-col items-start sm:items-end gap-3">
            {policies.length > 0 && (
              <nav className="flex items-center gap-5">
                {policies.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-[12px] text-gray-400 dark:text-dark-tertiary hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
            <p className="text-[12px] text-gray-400 dark:text-dark-muted">
              © {new Date().getFullYear()} {siteTitle}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
