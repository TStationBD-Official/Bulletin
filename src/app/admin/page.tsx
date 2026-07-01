"use client";

import { useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  BarChart3,
  Activity,
  Tag,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Trophy,
} from "lucide-react";
import {
  getAdminStats,
  getAllPostsAdmin,
  getAdminLogs,
} from "@/lib/firestore";
import { getAllCategoriesAdmin } from "@/lib/categories";
import { AdminStats, Post, AdminLog, Category } from "@/types";
import StatsCard from "@/components/admin/StatsCard";
import {
  PostsPerDayChart,
  EngagementTrendChart,
  AdminActivityChart,
} from "@/components/admin/Charts";
import { relativeTime, cn } from "@/lib/utils";
import { PageLoader } from "@/components/LoadingSpinner";
import { gsap, ScrollTrigger } from "@/lib/gsap";

const TILE_CHROME =
  "bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-card hover:shadow-card-hover transition-shadow duration-200 p-5 md:p-6";

const ADMIN_STALE_TIME = 30 * 1000;

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
    staleTime: ADMIN_STALE_TIME,
  });
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["admin", "posts"],
    queryFn: () => getAllPostsAdmin(),
    staleTime: ADMIN_STALE_TIME,
  });
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["admin", "logs"],
    queryFn: () => getAdminLogs(20),
    staleTime: ADMIN_STALE_TIME,
  });
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: getAllCategoriesAdmin,
    staleTime: ADMIN_STALE_TIME,
  });

  const loading = statsLoading || postsLoading || logsLoading || categoriesLoading;

  const statsGridRef      = useRef<HTMLDivElement>(null);
  const trendingGridRef   = useRef<HTMLDivElement>(null);
  const categoriesGridRef = useRef<HTMLDivElement>(null);

  /* ── Scroll-reveal for dashboard sections ────────────────── */
  useLayoutEffect(() => {
    if (!stats) return;

    const ctx = gsap.context(() => {
      const reveal = (container: HTMLElement | null) => {
        if (!container) return;
        const tiles = gsap.utils.toArray<HTMLElement>("[data-admin-tile]", container);
        if (tiles.length === 0) return;
        gsap.set(tiles, { opacity: 0, y: 16 });
        ScrollTrigger.batch(tiles, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, overwrite: true }),
        });
      };

      reveal(statsGridRef.current);
      reveal(trendingGridRef.current);
      reveal(categoriesGridRef.current);
    });

    const id = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(id);
      ctx.revert();
    };
  }, [stats, posts.length, logs.length, categories.length]);

  if (loading) return <PageLoader />;
  if (!stats) return null;

  const trendingPosts = [...posts]
    .filter((p) => p.status === "approved")
    .map((p) => ({
      ...p,
      score: (p.views ?? 0) + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const medals = [
    { bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-200 dark:border-yellow-700/40", icon: "🥇" },
    { bg: "bg-gray-50 dark:bg-gray-800/30",     border: "border-gray-200 dark:border-gray-700",        icon: "🥈" },
    { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-700/40", icon: "🥉" },
  ];

  return (
    <main className="p-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-primary">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-dark-tertiary mt-1">
            Real-time stats and moderation overview
          </p>
        </div>

        {/* Stats + charts bento */}
        <div ref={statsGridRef} className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 mb-8">
          <div data-admin-tile className={cn("col-span-1 lg:col-span-2", TILE_CHROME)}>
            <StatsCard label="Approved Posts" value={stats.totalApproved} icon={CheckCircle} color="green" bare />
          </div>
          <div data-admin-tile className={cn("col-span-1 lg:col-span-2", TILE_CHROME)}>
            <StatsCard label="Pending Review" value={stats.totalPending} icon={Clock} color="orange" bare />
          </div>
          <div data-admin-tile className={cn("col-span-1 lg:col-span-2", TILE_CHROME)}>
            <StatsCard label="Rejected Posts" value={stats.totalRejected} icon={XCircle} color="red" bare />
          </div>

          {/* Hero tile: total users */}
          <div
            data-admin-tile
            className={cn("col-span-1 sm:col-span-2 lg:col-span-3 lg:row-span-2 flex flex-col justify-between", TILE_CHROME)}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-dark-tertiary uppercase tracking-wide mb-1">
                  Total Users
                </p>
                <p className="text-4xl font-bold text-gray-900 dark:text-dark-primary">
                  {(
                    stats.totalFeedsUsers +
                    stats.totalAdmins +
                    stats.totalStudents +
                    stats.totalGuardians
                  ).toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                <Users size={22} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-4">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
                {stats.totalFeedsUsers} readers
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-admin-50 dark:bg-admin-900/20 text-admin-600">
                {stats.totalAdmins} admins
              </span>
            </div>
          </div>

          <div data-admin-tile className={cn("col-span-1 lg:col-span-3", TILE_CHROME)}>
            <StatsCard label="Total Engagement" value={stats.totalEngagement} icon={TrendingUp} color="blue" bare />
          </div>
          <div data-admin-tile className={cn("col-span-1 sm:col-span-2 lg:col-span-1", TILE_CHROME)}>
            <StatsCard
              label="Approval Rate"
              value={Math.round(stats.approvalRate * 100)}
              icon={BarChart3}
              color="green"
              trend={{
                value: Math.round(stats.approvalRate * 100) > 70 ? 5 : -5,
                isPositive: Math.round(stats.approvalRate * 100) > 70,
              }}
              bare
            />
          </div>
          <div data-admin-tile className={cn("col-span-1 lg:col-span-2", TILE_CHROME)}>
            <StatsCard label="New Users (7d)" value={stats.newRegistrations7Days} icon={Users} color="blue" bare />
          </div>

          {/* Charts */}
          <div data-admin-tile className={cn("col-span-1 sm:col-span-2 lg:col-span-3 min-h-[380px] flex flex-col", TILE_CHROME)}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-dark-primary mb-4">
              Posts per Day (30 days)
            </h3>
            <div className="flex-1">
              <PostsPerDayChart posts={posts} />
            </div>
          </div>
          <div data-admin-tile className={cn("col-span-1 sm:col-span-2 lg:col-span-3 min-h-[380px] flex flex-col", TILE_CHROME)}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-dark-primary mb-4">
              Engagement Trend
            </h3>
            <div className="flex-1">
              <EngagementTrendChart posts={posts} />
            </div>
          </div>
          <div data-admin-tile className={cn("col-span-1 sm:col-span-2 lg:col-span-6 min-h-[380px] flex flex-col", TILE_CHROME)}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-dark-primary mb-4">
              Admin Activity
            </h3>
            <div className="flex-1">
              <AdminActivityChart logs={logs} />
            </div>
          </div>
        </div>

        {/* Top 3 Trending Posts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-white dark:bg-dark-card rounded-2xl shadow-card p-6 border border-gray-100 dark:border-dark-border mb-8"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-dark-primary flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500" />
              Top Trending Posts
            </h3>
            <Link href="/admin/posts" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
              View all →
            </Link>
          </div>

          {trendingPosts.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-dark-tertiary text-center py-6">
              No approved posts yet
            </p>
          ) : (
            <div ref={trendingGridRef} className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-3 pt-2">
              {trendingPosts.map((post, i) => {
                const m = medals[i];
                return (
                  <article
                    key={post.id}
                    data-admin-tile
                    className={`relative rounded-xl border p-4 flex flex-col gap-3 ${m.bg} ${m.border}`}
                  >
                    {/* Medal */}
                    <span className="absolute -top-3 -left-1 text-2xl leading-none select-none drop-shadow-sm">
                      {m.icon}
                    </span>

                    {/* Category + score */}
                    <div className="flex items-center justify-between pt-2">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: (post.categoryColor ?? "#6366f1") + "18",
                          color: post.categoryColor ?? "#6366f1",
                        }}
                      >
                        <span>{post.categoryIcon ?? "📌"}</span>
                        <span>{post.categoryName ?? "General"}</span>
                      </span>
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                        {post.score.toLocaleString()} pts
                      </span>
                    </div>

                    {/* Title */}
                    <Link
                      href={`/post/${post.id}`}
                      target="_blank"
                      className="text-sm font-semibold text-gray-900 dark:text-dark-primary line-clamp-2 leading-snug hover:text-brand-600 transition-colors"
                    >
                      {post.title || "Untitled"}
                    </Link>

                    {/* Author */}
                    <p className="text-xs text-gray-500 dark:text-dark-tertiary truncate">
                      by <span className="font-medium text-gray-700 dark:text-dark-secondary">{post.authorName}</span>
                    </p>

                    {/* Stats breakdown */}
                    <div className="grid grid-cols-4 gap-1 pt-2 border-t border-black/5 dark:border-white/5">
                      {[
                        { icon: Eye,           val: post.views ?? 0,    label: "Views" },
                        { icon: Heart,         val: post.likes ?? 0,    label: "Likes" },
                        { icon: MessageCircle, val: post.comments ?? 0, label: "Cmts" },
                        { icon: Share2,        val: post.shares ?? 0,   label: "Shares" },
                      ].map(({ icon: Icon, val, label }) => (
                        <div key={label} className="flex flex-col items-center gap-0.5">
                          <Icon size={12} className="text-gray-400 dark:text-dark-tertiary" />
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-dark-primary leading-none">
                            {val.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-gray-400 dark:text-dark-tertiary leading-none">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Categories Overview */}
        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-dark-card rounded-2xl shadow-card p-6 border border-gray-100 dark:border-dark-border mb-8"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-dark-primary flex items-center gap-2">
                <Tag size={18} className="text-brand-500" />
                Categories
              </h3>
              <Link
                href="/admin/categories"
                className="text-xs text-brand-500 hover:text-brand-600 font-medium"
              >
                Manage →
              </Link>
            </div>

            <div ref={categoriesGridRef} className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  data-admin-tile
                  className="relative rounded-xl p-3.5 border transition-shadow hover:shadow-md cursor-default"
                  style={{
                    backgroundColor: cat.color + "12",
                    borderColor: cat.color + "30",
                  }}
                >
                  {/* Active dot */}
                  {!cat.isActive && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                  )}

                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-2.5"
                    style={{ backgroundColor: cat.color + "22" }}
                  >
                    {cat.icon}
                  </div>

                  {/* Name */}
                  <p className="text-xs font-semibold text-gray-800 dark:text-dark-primary leading-tight line-clamp-1 mb-1">
                    {cat.name}
                  </p>

                  {/* Post count */}
                  <p
                    className="text-xs font-bold"
                    style={{ color: cat.color }}
                  >
                    {cat.postCount ?? 0}{" "}
                    <span className="font-normal text-gray-400 dark:text-dark-tertiary">
                      {cat.postCount === 1 ? "post" : "posts"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Activity log */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-dark-card rounded-2xl shadow-card p-6 border border-gray-100 dark:border-dark-border"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-dark-primary flex items-center gap-2">
              <Activity size={18} /> Recent Activity
            </h3>
            <Link
              href="/admin/logs"
              className="text-xs text-brand-500 hover:text-brand-600 font-medium"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No activity yet
              </p>
            ) : (
              logs.slice(0, 10).map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-dark-border last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-primary capitalize">
                      {log.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-tertiary mt-0.5">
                      {log.reason && `Reason: ${log.reason} • `}
                      {relativeTime(log.createdAt)}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
