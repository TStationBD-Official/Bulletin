"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";
import { Post, AuthorProfile } from "@/types";

interface RelatedPostsCarouselProps {
  posts: Post[];
  authors: Record<string, AuthorProfile | null>;
  /** ms between auto-advances */
  interval?: number;
}

// Shown once in the article flow (after the body / mobile action bar, before
// comments) — same position works for every screen size, since the article
// column is the "left"/main portion regardless of breakpoint.
export default function RelatedPostsCarousel({ posts, authors, interval = 5000 }: RelatedPostsCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (posts.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % posts.length), interval);
    return () => clearInterval(id);
  }, [posts.length, interval]);

  if (posts.length === 0) return null;
  const post = posts[index];
  const author = authors[post.authorId];
  const excerpt = (post.content || "").replace(/<[^>]*>/g, "").trim();

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card p-4 sm:p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/30 dark:to-indigo-900/30 flex items-center justify-center">
            <Sparkles size={13} className="text-brand-500" />
          </div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-dark-primary uppercase tracking-widest">
            Related Posts
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
          <Link href={`/post/${post.id}`} className="group block">
            <h4 className="text-[15px] font-bold text-gray-900 dark:text-dark-primary leading-snug line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {post.title || "Untitled"}
            </h4>
            <p className="text-[13px] text-gray-500 dark:text-dark-tertiary mt-1.5 line-clamp-2 leading-relaxed">
              {excerpt}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
                {author?.profileImageUrl ? (
                  <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                    <User size={12} className="text-brand-500" />
                  </div>
                )}
              </div>
              <span className="text-[12px] font-medium text-gray-500 dark:text-dark-tertiary truncate">
                {author?.name ?? post.authorName}
              </span>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
