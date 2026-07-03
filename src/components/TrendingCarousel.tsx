"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { TrendingUp, Heart, MessageCircle, Share2 } from "lucide-react";
import { Post } from "@/types";

interface TrendingCarouselProps {
  title: string;
  posts: Post[];
  /** ms between auto-advances */
  interval?: number;
}

// Mobile-only auto-sliding version of TrendingBox — the desktop sidebar list
// (TrendingBox) is hidden below the lg breakpoint, so this fills that gap
// with a compact single-card-at-a-time carousel instead of a stacked list.
export default function TrendingCarousel({ title, posts, interval = 4500 }: TrendingCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (posts.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % posts.length), interval);
    return () => clearInterval(id);
  }, [posts.length, interval]);

  if (posts.length === 0) return null;
  const post = posts[index];

  return (
    <div className="lg:hidden bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border shadow-card p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center">
            <TrendingUp size={13} className="text-orange-500" />
          </div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-dark-primary uppercase tracking-widest">
            {title}
          </h3>
        </div>
        {posts.length > 1 && (
          <div className="flex items-center gap-1">
            {posts.map((_, i) => (
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
          key={post.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href={`/post/${post.id}`} className="flex gap-3.5 items-start">
            <span
              className="text-xl font-black flex-shrink-0 w-5 text-center leading-tight mt-0.5 tabular-nums"
              style={{ color: index === 0 ? "#f59e0b" : index === 1 ? "#94a3b8" : "#cbd5e1" }}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-semibold text-gray-900 dark:text-dark-primary line-clamp-1 leading-snug">
                {post.title || "Untitled"}
              </h4>
              <p className="text-[12px] text-gray-500 dark:text-dark-tertiary mt-1 line-clamp-2 leading-snug">
                {post.content?.replace(/<[^>]*>/g, "")}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400 dark:text-dark-tertiary">
                <span className="flex items-center gap-1"><Heart size={11} /> {post.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle size={11} /> {post.comments}</span>
                <span className="flex items-center gap-1"><Share2 size={11} /> {post.shares}</span>
              </div>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
