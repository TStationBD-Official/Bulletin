"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Users, User, ArrowRight } from "lucide-react";
import { AuthorProfile } from "@/types";

interface TopAuthorsCarouselProps {
  authors: (AuthorProfile & { totalEngagement: number; totalPosts: number })[];
  /** ms between auto-advances */
  interval?: number;
}

// Mobile-only auto-sliding version of the desktop "Top Authors" sidebar tile
// (hidden below the lg breakpoint) — one author card at a time instead of a
// stacked list, same auto-slide pattern as TrendingCarousel.
export default function TopAuthorsCarousel({ authors, interval = 4500 }: TopAuthorsCarouselProps) {
  const [index, setIndex] = useState(0);
  const shown = authors.slice(0, 6);

  useEffect(() => {
    if (shown.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % shown.length), interval);
    return () => clearInterval(id);
  }, [shown.length, interval]);

  if (shown.length === 0) return null;
  const author = shown[index];

  return (
    <div className="lg:hidden bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border shadow-card p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
            <Users size={13} className="text-indigo-500" />
          </div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-dark-primary uppercase tracking-widest">
            Top Authors
          </h3>
        </div>
        {shown.length > 1 && (
          <div className="flex items-center gap-1">
            {shown.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-brand-500" : "w-1.5 bg-gray-200 dark:bg-dark-tertiary/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={author.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href={`/author/${author.id}`} className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0 ring-2 ring-transparent">
              {author.profileImageUrl ? (
                <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                  <User size={18} className="text-brand-500" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-dark-primary truncate">
                {author.name}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mt-0.5">
                {author.totalPosts} posts · {author.totalEngagement.toLocaleString()} engagements
              </p>
            </div>
            <ArrowRight size={13} className="text-gray-300 dark:text-dark-muted flex-shrink-0" />
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
