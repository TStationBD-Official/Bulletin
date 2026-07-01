"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeToLatestPosts,
  getMorePosts,
  resolveAuthor,
  getTrendingPosts,
  getTopAuthors,
} from "@/lib/firestore";
import { getCategories, SEED_CATEGORIES } from "@/lib/categories";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile, Category } from "@/types";
import { toDate, readingTime } from "@/lib/utils";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import Link from "next/link";
import {
  ArrowLeft, Calendar, X, ChevronDown,
  TrendingUp, Users, ArrowRight, User, Heart,
} from "lucide-react";

type QuickRange = "all" | "today" | "week" | "month" | "year";

const QUICK_RANGES: { label: string; value: QuickRange }[] = [
  { label: "All time",   value: "all"   },
  { label: "Today",      value: "today" },
  { label: "This week",  value: "week"  },
  { label: "This month", value: "month" },
  { label: "This year",  value: "year"  },
];

function quickRangeStart(range: QuickRange): Date | null {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week")  { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "year")  return new Date(now.getFullYear(), 0, 1);
  return null;
}

function toInputValue(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function AllPostsPage() {
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const query          = searchParams.get("q")?.toLowerCase() || "";
  const categoryFilter = searchParams.get("c") || null;

  const { user, userRole, userData } = useStore();

  const [posts,        setPosts]        = useState<Post[]>([]);
  const [trending,     setTrending]     = useState<Post[]>([]);
  const [topAuthors,   setTopAuthors]   = useState<Array<AuthorProfile & { totalEngagement: number; totalPosts: number }>>([]);
  const [authorCache,  setAuthorCache]  = useState<Record<string, AuthorProfile | null>>({});
  const [loading,      setLoading]      = useState(true);
  const [hasMore,      setHasMore]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [categories,   setCategories]   = useState<Category[]>([]);

  // Date filter state
  const [quickRange,  setQuickRange]  = useState<QuickRange>("all");
  const [pickerFrom,  setPickerFrom]  = useState("");
  const [pickerTo,    setPickerTo]    = useState("");
  const [showPicker,  setShowPicker]  = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const adminGroupId: string | null =
          userRole === "admin" && user ? user.uid
          : (userRole === "student" || userRole === "guardian") && userData
          ? (userData as any)?.adminId ?? null : null;

        unsub = subscribeToLatestPosts(
          (p) => { setPosts(p); lastDocRef.current = null; },
          { adminGroupId: adminGroupId ?? undefined, isSuperAdmin: userRole === "superAdmin" },
          50
        );

        const [cats, trendingPosts, authors] = await Promise.all([
          getCategories().catch(() => []),
          getTrendingPosts(),
          getTopAuthors(),
        ]);

        setCategories(cats.length > 0 ? cats : (SEED_CATEGORIES as any));
        setTrending(trendingPosts);
        setTopAuthors(authors);

        // Resolve authors for trending sidebar
        const trendIds = Array.from(new Set(trendingPosts.map((p) => p.authorId)));
        const resolved: Record<string, AuthorProfile | null> = {};
        await Promise.all(trendIds.map(async (id) => { resolved[id] = await resolveAuthor(id); }));
        setAuthorCache((prev) => ({ ...prev, ...resolved }));
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub?.();
  }, [user?.uid, userRole]);

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

  const handleLoadMore = async () => {
    if (!lastDocRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { posts: newPosts, lastDoc } = await getMorePosts(lastDocRef.current);
      if (newPosts.length < 20) setHasMore(false);
      setPosts((p) => [...p, ...newPosts]);
      lastDocRef.current = lastDoc;
    } finally {
      setLoadingMore(false);
    }
  };

  const applyCustomRange = () => {
    if (pickerFrom || pickerTo) setQuickRange("all");
    setShowPicker(false);
  };

  const clearDateFilter = () => {
    setQuickRange("all");
    setPickerFrom("");
    setPickerTo("");
  };

  const hasCustomDate  = pickerFrom || pickerTo;
  const effectiveStart = hasCustomDate
    ? (pickerFrom ? new Date(pickerFrom + "T00:00:00") : null)
    : quickRangeStart(quickRange);
  const effectiveEnd   = hasCustomDate && pickerTo
    ? new Date(pickerTo + "T23:59:59")
    : null;

  const isDateFiltered = quickRange !== "all" || hasCustomDate;

  const activeQuickLabel = QUICK_RANGES.find((r) => r.value === quickRange)?.label ?? "";
  const activeDateLabel  = hasCustomDate
    ? [pickerFrom, pickerTo].filter(Boolean).join(" → ")
    : quickRange !== "all" ? activeQuickLabel : "";

  const filteredPosts = posts.filter((p) => {
    const matchQuery    = !query || p.content?.toLowerCase().includes(query) || p.authorName?.toLowerCase().includes(query);
    const matchCategory = !categoryFilter || (p.categoryId ?? "general") === categoryFilter;
    const postDate      = toDate(p.createdAt);
    const matchDate     = (!effectiveStart || postDate >= effectiveStart) &&
                          (!effectiveEnd   || postDate <= effectiveEnd);
    return matchQuery && matchCategory && matchDate;
  });

  const activeCategory = categories.find((c) => c.id === categoryFilter);

  if (loading) return <PageLoader />;

  return (
    <main className="page min-h-screen bg-white dark:bg-dark-bg">

      {/* ── Category tabs ──────────────────────────────────── */}
      <div className="border-b border-gray-100 dark:border-dark-border sticky top-16 z-30 bg-white/95 dark:bg-dark-bg/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2">
            <button
              onClick={() => router.push("/posts")}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap ${
                !categoryFilter && !query
                  ? "bg-gray-900 dark:bg-dark-primary text-white dark:text-dark-bg"
                  : "text-gray-500 dark:text-dark-tertiary hover:text-gray-900 dark:hover:text-dark-primary hover:bg-gray-100 dark:hover:bg-dark-card"
              }`}
            >
              All
            </button>
            {categories.map((cat) => {
              const active = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => router.push(active ? "/posts" : `/posts?c=${cat.id}`)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all whitespace-nowrap ${
                    active ? "text-white" : "text-gray-500 dark:text-dark-tertiary hover:text-gray-900 dark:hover:text-dark-primary hover:bg-gray-100 dark:hover:bg-dark-card"
                  }`}
                  style={active ? { backgroundColor: cat.color } : {}}
                >
                  {cat.icon} {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-12">

          {/* ── Left: feed ─────────────────────────────────────── */}
          <div>
            {/* Header + filter bar */}
            <div className="mb-8">
              {/* Title row */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  {activeCategory ? (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{activeCategory.icon}</span>
                      <h1 className="text-xl font-bold text-gray-900 dark:text-dark-primary truncate">{activeCategory.name}</h1>
                    </div>
                  ) : query ? (
                    <p className="text-sm text-gray-500 dark:text-dark-tertiary">
                      Results for <span className="font-semibold text-gray-900 dark:text-dark-primary">"{query}"</span>
                    </p>
                  ) : (
                    <h1 className="text-xl font-bold text-gray-900 dark:text-dark-primary">All Posts</h1>
                  )}
                  <p className="text-sm text-gray-400 dark:text-dark-tertiary mt-0.5">
                    {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
                    {activeDateLabel && <span className="ml-1">· {activeDateLabel}</span>}
                  </p>
                </div>
                <Link
                  href="/"
                  className="flex-shrink-0 flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-tertiary hover:text-gray-900 dark:hover:text-dark-primary transition-colors whitespace-nowrap"
                >
                  <ArrowLeft size={14} /> Home
                </Link>
              </div>

              {/* Filter controls */}
              <div className="flex flex-col gap-2">
                {/* Quick range pills — horizontally scrollable on mobile */}
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-dark-card rounded-xl w-max sm:w-auto">
                    {QUICK_RANGES.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setQuickRange(opt.value); setPickerFrom(""); setPickerTo(""); }}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                          quickRange === opt.value && !hasCustomDate
                            ? "bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-primary shadow-sm"
                            : "text-gray-500 dark:text-dark-tertiary hover:text-gray-700 dark:hover:text-dark-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calendar + Clear */}
                <div className="flex items-center gap-2">
                  <div className="relative" ref={pickerRef}>
                    <button
                      onClick={() => setShowPicker((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
                        hasCustomDate
                          ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                          : "border-gray-200 dark:border-dark-border text-gray-500 dark:text-dark-tertiary hover:border-gray-300 dark:hover:border-dark-tertiary hover:text-gray-700 dark:hover:text-dark-secondary"
                      }`}
                    >
                      <Calendar size={13} />
                      <span className="hidden min-[400px]:inline">{hasCustomDate ? activeDateLabel : "Pick date"}</span>
                      <span className="min-[400px]:hidden">Date</span>
                      <ChevronDown size={12} className={`transition-transform ${showPicker ? "rotate-180" : ""}`} />
                    </button>

                    <AnimatePresence>
                      {showPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-xl p-4 w-[min(18rem,calc(100vw-2rem))]"
                        >
                          <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-widest mb-3">
                            Date range
                          </p>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[12px] font-semibold text-gray-600 dark:text-dark-secondary block mb-1">From</label>
                              <input
                                type="date"
                                value={pickerFrom}
                                max={pickerTo || toInputValue(new Date())}
                                onChange={(e) => setPickerFrom(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-primary focus:outline-none focus:border-brand-400 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-[12px] font-semibold text-gray-600 dark:text-dark-secondary block mb-1">To</label>
                              <input
                                type="date"
                                value={pickerTo}
                                min={pickerFrom}
                                max={toInputValue(new Date())}
                                onChange={(e) => setPickerTo(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-primary focus:outline-none focus:border-brand-400 transition-colors"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={applyCustomRange}
                              className="flex-1 py-2 rounded-xl bg-gray-900 dark:bg-dark-primary text-white dark:text-dark-bg text-xs font-bold hover:bg-gray-700 transition-colors"
                            >
                              Apply
                            </button>
                            <button
                              onClick={() => { setPickerFrom(""); setPickerTo(""); setShowPicker(false); }}
                              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-xs font-semibold text-gray-500 dark:text-dark-tertiary hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {isDateFiltered && (
                    <button
                      onClick={clearDateFilter}
                      className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-dark-tertiary hover:text-red-400 transition-colors"
                      title="Clear date filter"
                    >
                      <X size={13} /> Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Feed */}
            {filteredPosts.length === 0 ? (
              isDateFiltered ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">📅</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-dark-primary">
                    No posts in this date range
                  </p>
                  <p className="text-sm text-gray-400 dark:text-dark-tertiary mt-1 mb-4">
                    Try a different range or clear the filter
                  </p>
                  <button
                    onClick={clearDateFilter}
                    className="px-5 py-2 text-sm font-semibold text-brand-500 border border-brand-200 hover:border-brand-400 rounded-full transition-colors"
                  >
                    Show all posts
                  </button>
                </div>
              ) : (
                <EmptyState
                  icon="📭"
                  title="No posts yet"
                  description={query ? "Try a different search" : "Be the first to write something!"}
                  action={{ label: "Write a post", href: "/compose" }}
                />
              )
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

                {hasMore && !isDateFiltered && (
                  <div className="flex justify-center pt-8">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 px-6 py-2.5 border border-gray-200 dark:border-dark-border text-sm font-semibold text-gray-700 dark:text-dark-primary rounded-full hover:bg-gray-50 dark:hover:bg-dark-card disabled:opacity-50 transition-colors"
                    >
                      {loadingMore ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                            className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full"
                          />
                          Loading…
                        </>
                      ) : (
                        "Load more"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: sidebar ─────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-8">

              {/* Trending */}
              {trending.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={14} className="text-gray-400 dark:text-dark-tertiary" />
                    <h3 className="text-xs font-bold text-gray-500 dark:text-dark-tertiary uppercase tracking-widest">
                      Trending
                    </h3>
                  </div>
                  <div className="space-y-5">
                    {trending.map((post, i) => {
                      const trendAuthor = authorCache[post.authorId];
                      return (
                        <Link key={post.id} href={`/post/${post.id}`} className="group flex gap-3">
                          <span className="text-2xl font-black flex-shrink-0 w-6 text-center leading-none pt-1" style={{ color: "#94a3b8" }}>
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
                                {trendAuthor?.profileImageUrl ? (
                                  <img src={trendAuthor.profileImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                                    <User size={8} className="text-brand-500" />
                                  </div>
                                )}
                              </div>
                              <span className="text-[11px] font-semibold text-gray-600 dark:text-dark-secondary truncate">{post.authorName}</span>
                            </div>
                            <h4 className="text-[13px] font-bold text-gray-900 dark:text-dark-primary line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                              {post.title || post.content?.replace(/<[^>]*>/g, "").slice(0, 60)}
                            </h4>
                            <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mt-1">
                              {readingTime(post.content || "")} min · <span className="inline-flex items-center gap-1"><Heart size={9} className="inline" /> {post.likes}</span>
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Divider */}
              {trending.length > 0 && topAuthors.length > 0 && (
                <div className="border-t border-gray-100 dark:border-dark-border" />
              )}

              {/* Top Authors */}
              {topAuthors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Users size={14} className="text-gray-400 dark:text-dark-tertiary" />
                    <h3 className="text-xs font-bold text-gray-500 dark:text-dark-tertiary uppercase tracking-widest">
                      Top Authors
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {topAuthors.slice(0, 3).map((author) => (
                      <Link key={author.id} href={`/author/${author.id}`} className="group flex items-center gap-3">
                        <motion.div
                          whileHover={{ scale: 1.08 }}
                          transition={{ duration: 0.2 }}
                          className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0"
                        >
                          {author.profileImageUrl ? (
                            <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                              <User size={16} className="text-brand-500" />
                            </div>
                          )}
                        </motion.div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-dark-primary truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {author.name}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-dark-tertiary">
                            {author.totalPosts} posts · {author.totalEngagement.toLocaleString()} engagement
                          </p>
                        </div>
                        <ArrowRight size={13} className="text-gray-300 dark:text-dark-muted group-hover:text-brand-500 transition-colors flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}


            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}
