"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/store/useStore";

interface PolicyPageProps {
  content: string;
  title: string;
  icon: string;
}

// Hardcoded rather than read from app_settings/feeds_website — this content
// changes rarely, so baking it into the bundle avoids a Firestore read on
// every visit to these three pages.
export default function PolicyPage({ content, title, icon }: PolicyPageProps) {
  const { settings } = useStore();
  const siteTitle = settings?.siteTitle || "The Net Chronicle";

  return (
    <main className="page min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to feed
        </Link>

        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-8">
          <div className="mb-6 pb-6 border-b border-gray-100 dark:border-dark-border">
            <div className="text-4xl mb-3">{icon}</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-primary">{title}</h1>
            <p className="text-sm text-gray-400 dark:text-dark-tertiary mt-1">{siteTitle}</p>
          </div>

          {content ? (
            <div className="prose prose-sm max-w-none text-gray-700 dark:text-dark-secondary leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 dark:text-dark-tertiary text-sm">
                This policy hasn't been set yet. Please check back later.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
