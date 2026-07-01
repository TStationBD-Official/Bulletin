"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  getTrendingPosts,
  getTopAuthors,
  subscribeToLatestPosts,
  resolveAuthor,
} from "@/lib/firestore";
import { getCategories, SEED_CATEGORIES } from "@/lib/categories";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile, Category } from "@/types";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import Link from "next/link";
import { TrendingUp, Users, ArrowRight, User, Heart } from "lucide-react";
import { relativeTime, readingTime } from "@/lib/utils";

export default function FeedPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const query        = searchParams.get("q")?.toLowerCase() || "";
  const categoryFilter = searchParams.get("c") || null;

  const { user, userRole, userData } = useStore();

  const [posts,       setPosts]       = useState<Post[]>([]);
  const [trending,    setTrending]    = useState<Post[]>([]);
  const [topAuthors,  setTopAuthors]  = useState<Array<AuthorProfile & { totalEngagement: number; totalPosts: number }>>([]);
  const [authorCache, setAuthorCache] = useState<Record<string, AuthorProfile | null>>({});
  const [loading,    setLoading]    = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  /* ── Initial data load ──────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const adminGroupId: string | null =
          userRole === "admin" && user
            ? user.uid
            : (userRole === "student" || userRole === "guardian") && userData
            ? (userData as any)?.adminId ?? null
            : null;

        unsub = subscribeToLatestPosts(
          (p) => { setPosts(p); },
          { adminGroupId: adminGroupId ?? undefined, isSuperAdmin: userRole === "superAdmin" },
          5
        );

        const [trendingPosts, authors, cats] = await Promise.all([
          getTrendingPosts(),
          getTopAuthors(),
          getCategories().catch(() => []),
        ]);

        setCategories(cats.length > 0 ? cats : (SEED_CATEGORIES as any));
        setTrending(trendingPosts);
        setTopAuthors(authors);

        // Resolve authors for trending
        const ids = Array.from(new Set(trendingPosts.map((p) => p.authorId)));
        const resolved: Record<string, AuthorProfile | null> = {};
        await Promise.all(ids.map(async (id) => { resolved[id] = await resolveAuthor(id); }));
        setAuthorCache(resolved);
      } finally {
        setLoading(false);
      }
    })();

    return () => unsub?.();
  }, [user?.uid, userRole]);

  /* ── Resolve authors for feed posts ─────────────────────── */
  useEffect(() => {
    const missing = posts.filter((p) => !authorCache[p.authorId]);
    if (missing.length === 0) return;
    const ids = Array.from(new Set(missing.map((p) => p.authorId)));
    (async () => {
      const entries: Record<string, AuthorProfile | null> = {};
      await Promise.all(ids.map(async (id) => { entries[id] = await resolveAuthor(id); }));
      setAuthorCache((prev) => ({ ...prev, ...entries }));
    })();
  }, [posts]);

  /* ── Filter ──────────────────────────────────────────────── */
  const filteredPosts = posts.filter((p) => {
    const matchQuery    = !query || p.content?.toLowerCase().includes(query) || p.authorName?.toLowerCase().includes(query);
    const matchCategory = !categoryFilter || (p.categoryId ?? "general") === categoryFilter;
    return matchQuery && matchCategory;
  });

  const activeCategory = categories.find((c) => c.id === categoryFilter);

  if (loading) return <PageLoader />;

  return (
    /*
     * On lg+ screens: main fills the remaining viewport height below the header
     * and switches to a flex-col layout so the tab bar is fixed-height and
     * the two-panel grid below gets its own independent scroll per column.
     * On mobile: normal page scroll (min-h-screen, no overflow restriction).
     */
    <main className="bg-gray-50/50 dark:bg-dark-bg min-h-screen lg:h-[calc(100vh-4rem)] lg:flex lg:flex-col lg:overflow-hidden">

      {/* ── Category tabs ─────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white/90 dark:bg-dark-bg/90 backdrop-blur-xl border-b border-gray-100 dark:border-dark-border z-30 sticky top-16 lg:static">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => router.push("/")}
              className={`flex-shrink-0 px-4 py-3.5 text-[13px] font-semibold transition-all whitespace-nowrap border-b-2 ${
                !categoryFilter && !query
                  ? "border-gray-900 dark:border-dark-primary text-gray-900 dark:text-dark-primary"
                  : "border-transparent text-gray-500 dark:text-dark-tertiary hover:text-gray-800 dark:hover:text-dark-secondary hover:border-gray-300 dark:hover:border-dark-border"
              }`}
            >
              For You
            </button>
            {categories.map((cat) => {
              const active = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => router.push(active ? "/" : `/?c=${cat.id}`)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-semibold transition-all whitespace-nowrap border-b-2 ${
                    active
                      ? "border-current"
                      : "border-transparent text-gray-500 dark:text-dark-tertiary hover:text-gray-800 dark:hover:text-dark-secondary hover:border-gray-300 dark:hover:border-dark-border"
                  }`}
                  style={active ? { color: cat.color } : {}}
                >
                  <span>{cat.icon}</span> {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Two-panel area — each column scrolls independently on lg+ ── */}
      <div className="flex-1 lg:overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-8 xl:gap-12 lg:h-full">

            {/* ── Feed — independent scroll ─────────────────────── */}
            <div className="lg:overflow-y-auto lg:h-full py-6 scrollbar-hide">

              {/* Search banner */}
              {query && (
                <div className="mb-6 px-5 py-4 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border">
                  <p className="text-sm text-gray-500 dark:text-dark-tertiary">
                    Results for{" "}
                    <span className="font-semibold text-gray-900 dark:text-dark-primary">"{query}"</span>
                    {filteredPosts.length > 0 && (
                      <span className="ml-2 text-[12px] text-gray-400 dark:text-dark-tertiary">— {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Category header */}
              {activeCategory && !query && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 mb-6 px-5 py-4 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border"
                >
                  <span className="text-4xl">{activeCategory.icon}</span>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-dark-primary">{activeCategory.name}</h1>
                    {activeCategory.description && (
                      <p className="text-sm text-gray-500 dark:text-dark-tertiary mt-0.5">{activeCategory.description}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {filteredPosts.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No posts yet"
                  description={query ? "Try a different search" : "Be the first to write something!"}
                  action={{ label: "Write a post", href: "/compose" }}
                />
              ) : (
                <div>
                  {filteredPosts.map((post, i) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      author={authorCache[post.authorId]}
                      index={i}
                    />
                  ))}
                  <div className="flex justify-center pt-6 pb-8">
                    <Link
                      href={categoryFilter ? `/posts?c=${categoryFilter}` : "/posts"}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-[13px] font-semibold text-gray-700 dark:text-dark-primary rounded-xl hover:bg-gray-50 dark:hover:bg-dark-border/60 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow"
                    >
                      View all posts
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* ── Sidebar — independent scroll ──────────────────── */}
            <aside className="hidden lg:flex lg:flex-col lg:overflow-y-auto lg:h-full py-6 scrollbar-hide">
              <div className="space-y-4 pb-8">

                {/* Trending */}
                {trending.length > 0 && (
                  <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center">
                        <TrendingUp size={13} className="text-orange-500" />
                      </div>
                      <h3 className="text-xs font-bold text-gray-900 dark:text-dark-primary uppercase tracking-widest">
                        Trending
                      </h3>
                    </div>
                    <div className="space-y-5">
                      {trending.map((post, i) => {
                        const trendAuthor = authorCache[post.authorId];
                        return (
                          <Link key={post.id} href={`/post/${post.id}`} className="group flex gap-3.5 items-start">
                            <span className="text-xl font-black flex-shrink-0 w-5 text-center leading-tight mt-0.5 tabular-nums" style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#cbd5e1" }}>
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
                                  {trendAuthor?.profileImageUrl ? (
                                    <img src={trendAuthor.profileImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                                      <User size={8} className="text-brand-500" />
                                    </div>
                                  )}
                                </div>
                                <span className="text-[11px] font-medium text-gray-500 dark:text-dark-tertiary truncate">{post.authorName}</span>
                              </div>
                              <h4 className="text-[13px] font-semibold text-gray-900 dark:text-dark-primary line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                {post.title || post.content?.replace(/<[^>]*>/g, "").slice(0, 60)}
                              </h4>
                              <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mt-1.5 flex items-center gap-1.5">
                                <Heart size={9} />
                                {post.likes}
                                <span className="text-gray-200 dark:text-dark-muted">·</span>
                                {readingTime(post.content || "")} min read
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top Authors */}
                {topAuthors.length > 0 && (
                  <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                        <Users size={13} className="text-brand-500" />
                      </div>
                      <h3 className="text-xs font-bold text-gray-900 dark:text-dark-primary uppercase tracking-widest">
                        Top Authors
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {topAuthors.slice(0, 6).map((author) => (
                        <Link key={author.id} href={`/author/${author.id}`} className="group flex items-center gap-3">
                          <motion.div
                            whileHover={{ scale: 1.08 }}
                            transition={{ duration: 0.2 }}
                            className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0 ring-2 ring-transparent group-hover:ring-brand-200 dark:group-hover:ring-brand-800 transition-all"
                          >
                            {author.profileImageUrl ? (
                              <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                                <User size={16} className="text-brand-500" />
                              </div>
                            )}
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-gray-900 dark:text-dark-primary truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                              {author.name}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mt-0.5">
                              {author.totalPosts} posts · {author.totalEngagement.toLocaleString()} engagements
                            </p>
                          </div>
                          <ArrowRight size={13} className="text-gray-200 dark:text-dark-muted group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Write CTA */}
                <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-brand-500/20">
                  <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                  <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                  <div className="relative">
                    <h4 className="font-bold text-white text-sm mb-1">Share your knowledge</h4>
                    <p className="text-[12px] text-white/70 mb-4 leading-relaxed">
                      Write for the Bulletin community and reach thousands of readers.
                    </p>
                    <Link
                      href="/compose"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-brand-700 text-[12px] font-bold rounded-xl hover:bg-brand-50 transition-colors shadow-sm"
                    >
                      Start writing
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>

              </div>
            </aside>

          </div>
        </div>
      </div>
    </main>
  );
}
