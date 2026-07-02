"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-gray-100 dark:border-dark-border bg-white dark:bg-dark-bg mt-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left sm:justify-between gap-3 sm:gap-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-1.5 sm:gap-2">
            <Logo size={28} showName />
            {description && (
              <p className="text-[12px] text-gray-400 dark:text-dark-tertiary max-w-xs leading-relaxed hidden sm:block">
                {description}
              </p>
            )}
          </div>

          {/* Right: links + copyright */}
          <div className="flex flex-col items-center sm:items-end gap-2">
            {policies.length > 0 && (
              <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
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
            <p className="text-[12px] text-gray-400 dark:text-dark-muted flex items-center gap-1.5 flex-wrap justify-center">
              <span>© {new Date().getFullYear()} {siteTitle}. All rights reserved.</span>
              <span className="text-gray-200 dark:text-dark-muted">·</span>
              <a
                href="https://tuitioncore.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
              >
                <img src="/tuitioncore.png" alt="" className="w-3.5 h-3.5 rounded-sm object-cover flex-shrink-0" />
                Powered by TuitionCore
              </a>
            </p>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
