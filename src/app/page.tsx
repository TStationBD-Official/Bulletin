"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  getWeeklyTrendingPosts,
  getMonthlyTrendingPosts,
  getTopAuthors,
  subscribeToLatestPosts,
  resolveAuthor,
  getSavedPostIds,
} from "@/lib/firestore";
import { getCategories, SEED_CATEGORIES } from "@/lib/categories";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile, Category } from "@/types";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import Link from "next/link";
import { Users, ArrowRight, User } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { BentoGrid, BentoTile } from "@/components/BentoGrid";
import TrendingBox from "@/components/TrendingBox";
import Footer from "@/components/Footer";
import { gsap, ScrollTrigger } from "@/lib/gsap";

export default function FeedPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const query        = searchParams.get("q")?.toLowerCase() || "";
  const categoryFilter = searchParams.get("c") || null;

  const { user, userRole, userData } = useStore();

  const [posts,       setPosts]       = useState<Post[]>([]);
  const [authorCache, setAuthorCache] = useState<Record<string, AuthorProfile | null>>({});
  const [postsLoading, setPostsLoading] = useState(true);

  const { data: weeklyTrending = [] }  = useQuery({ queryKey: ["trending", "weekly"],  queryFn: getWeeklyTrendingPosts });
  const { data: monthlyTrending = [] } = useQuery({ queryKey: ["trending", "monthly"], queryFn: getMonthlyTrendingPosts });
  const { data: topAuthors = [], error: topAuthorsError } = useQuery({
    queryKey: ["topAuthors"],
    queryFn: getTopAuthors,
  });
  const { data: savedPostIds = [] } = useQuery({
    queryKey: ["savedPostIds", user?.uid, userRole],
    queryFn: () => getSavedPostIds(user!.uid, userRole!),
    enabled: !!user && !!userRole,
  });
  const savedIdSet = new Set(savedPostIds);
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const cats = await getCategories().catch(() => []);
      return cats.length > 0 ? cats : (SEED_CATEGORIES as any as Category[]);
    },
  });

  const loading = postsLoading || categoriesLoading;

  const bannerRef        = useRef<HTMLDivElement>(null);
  const circleTopRef     = useRef<HTMLDivElement>(null);
  const circleBottomRef  = useRef<HTMLDivElement>(null);

  /* ── Banner parallax ─────────────────────────────────────── */
  useEffect(() => {
    if (!bannerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(circleTopRef.current, {
        yPercent: 40,
        ease: "none",
        scrollTrigger: {
          trigger: bannerRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
      gsap.to(circleBottomRef.current, {
        yPercent: -25,
        ease: "none",
        scrollTrigger: {
          trigger: bannerRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }, bannerRef);

    return () => ctx.revert();
  }, []);

  /* ── Real-time feed subscription ──────────────────────────── */
  useEffect(() => {
    setPostsLoading(true);

    const adminGroupId: string | null =
      userRole === "admin" && user
        ? user.uid
        : (userRole === "student" || userRole === "guardian") && userData
        ? (userData as any)?.adminId ?? null
        : null;

    const unsub = subscribeToLatestPosts(
      (p) => { setPosts(p); setPostsLoading(false); },
      { adminGroupId: adminGroupId ?? undefined, isSuperAdmin: userRole === "superAdmin" },
      5
    );

    return () => unsub();
  }, [user?.uid, userRole]);

  useEffect(() => {
    if (topAuthorsError) console.error("Failed to load top authors:", topAuthorsError);
  }, [topAuthorsError]);

  /* ── Resolve authors for feed posts ─────────────────────── */
  useEffect(() => {
    const missing = posts.filter((p) => !authorCache[p.authorId]);
    if (missing.length === 0) return;
    const ids = Array.from(new Set(missing.map((p) => p.authorId)));
    (async () => {
      const entries: Record<string, AuthorProfile | null> = {};
      await Promise.all(ids.map(async (id) => { entries[id] = await resolveAuthor(id).catch(() => null); }));
      setAuthorCache((prev) => ({ ...prev, ...entries }));
    })();
  }, [posts]);

  /* ── Filter ──────────────────────────────────────────────── */
  const filteredPosts = posts.filter((p) => {
    const matchQuery    = !query || p.content?.toLowerCase().includes(query) || p.authorName?.toLowerCase().includes(query);
    const matchCategory = !categoryFilter || (p.categoryId ?? "general") === categoryFilter;
    return matchQuery && matchCategory;
  });

  const feedColumnRef = useRef<HTMLDivElement>(null);
  const postIdsKey = filteredPosts.map((p) => p.id).join(",");

  /* ── Feed card reveal on scroll ───────────────────────────── */
  useLayoutEffect(() => {
    if (filteredPosts.length === 0) return;

    // The page scrolls as a single unit at every breakpoint now, so the
    // scroller is always the window — no responsive branching needed.
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-post-card]", feedColumnRef.current);
      if (cards.length === 0) return;
      gsap.set(cards, { opacity: 0, y: 16 });
      ScrollTrigger.batch(cards, {
        start: "top 90%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, overwrite: true }),
      });
    }, feedColumnRef);

    const id = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(id);
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey]);

  if (loading) return <PageLoader />;

  return (
    /*
     * The whole page scrolls as one unit at every breakpoint (feed + sidebar
     * move together). The category tab bar stays sticky under the header.
     * The sidebar is sticky too, so it stays in view while scrolling the
     * feed — but keeps its own bounded height + overflow-y-auto so it can
     * still scroll independently if its own content is taller than the
     * available viewport space.
     */
    <main className="bg-gray-50/50 dark:bg-dark-bg min-h-screen">

      {/* ── TuitionCore promo banner ──────────────────────────── */}
      <div className="flex-shrink-0 max-w-7xl mx-auto w-full px-3 sm:px-6 pt-3 sm:pt-4">
        <div ref={bannerRef} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 shadow-lg shadow-brand-500/20 px-4 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
          <div ref={circleTopRef} className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div ref={circleBottomRef} className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="relative flex-1 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
            <img
              src="/tuitioncore.png"
              alt="TuitionCore"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/30 bg-white/10"
            />
            <div>
              <span className="inline-block text-[10px] sm:text-[11px] font-bold text-white/80 uppercase tracking-widest mb-1">
                Powered by TuitionCore
              </span>
              <h2 className="text-base sm:text-xl font-bold text-white leading-snug">
                Bulletin runs on TuitionCore — a complete system to manage students
              </h2>
              <p className="text-[13px] sm:text-sm text-white/80 mt-1">
                Attendance, performance, fees and communication, all in one place for tutors and admins.
              </p>
            </div>
          </div>

          <a
            href="https://tuitioncore.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="relative w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white text-brand-700 text-sm font-bold rounded-xl hover:bg-brand-50 active:scale-95 transition-all shadow-sm"
          >
            Know more
            <ArrowRight size={15} />
          </a>
        </div>
      </div>

      {/* ── Category tabs ─────────────────────────────────────── */}
      <div className="bg-white/90 dark:bg-dark-bg/90 backdrop-blur-xl border-b border-gray-100 dark:border-dark-border z-30 sticky top-16">
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

      {/* ── Two-panel area — scrolls together as one page ────── */}
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-8 xl:gap-12 lg:items-start">

            {/* ── Feed ──────────────────────────────────────────── */}
            <div ref={feedColumnRef} className="py-6">

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
                      isSaved={savedIdSet.has(post.id)}
                      disableMountAnimation
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

              {/* Footer lives at the natural end of the feed on lg+, since
                  the page now scrolls as a single unit. */}
              <div className="hidden lg:block mt-8">
                <Footer />
              </div>
            </div>

            {/* ── Sidebar — sticky, with its own scroll if it overflows ── */}
            <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto py-6 scrollbar-hide">
              <BentoGrid cols="grid-cols-1" className="pb-8">

                {/* Weekly Trending */}
                <TrendingBox title="Weekly Trending" posts={weeklyTrending} />

                {/* Monthly Trending */}
                <TrendingBox title="Monthly Trending" posts={monthlyTrending} />

                {/* Top Authors */}
                {topAuthors.length > 0 && (
                  <BentoTile className="p-5">
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
                          <ArrowRight size={13} className="text-gray-300 dark:text-dark-muted group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </BentoTile>
                )}

                {/* Write CTA */}
                <BentoTile bare className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-brand-500/20">
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
                </BentoTile>

              </BentoGrid>
            </aside>

          </div>
        </div>
      </div>
    </main>
  );
}
