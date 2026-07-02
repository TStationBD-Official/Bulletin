"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, User, FileText, Heart, MessageCircle, Eye, Bookmark,
  HardDrive, RefreshCw, CheckCircle2, AlertCircle, LogOut,
} from "lucide-react";
import { getMyPosts, resolveAuthor, getSavedPostIds } from "@/lib/firestore";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile } from "@/types";
import PostCard from "@/components/PostCard";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import toast from "react-hot-toast";
import { storeDriveToken } from "@/lib/driveAuth";
import { BentoGrid, BentoTile } from "@/components/BentoGrid";
import { colorMap } from "@/components/admin/StatsCard";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, userRole, accessToken, setAccessToken } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "drive">(
    searchParams.get("tab") === "drive" ? "drive" : "posts"
  );

  const displayName = (userData as any)?.name ?? user?.displayName ?? "";
  const photoURL    = (userData as any)?.profileImageUrl ?? user?.photoURL ?? null;
  const email       = (userData as any)?.email ?? user?.email ?? "";

  const { data: savedPostIds = [] } = useQuery({
    queryKey: ["savedPostIds", user?.uid, userRole],
    queryFn: () => getSavedPostIds(user!.uid, userRole!),
    enabled: !!user && !!userRole,
  });
  const savedIdSet = new Set(savedPostIds);

  useEffect(() => {
    if (!user) { router.replace("/"); return; }
    (async () => {
      try {
        const [p, profile] = await Promise.all([
          getMyPosts(user.uid),
          resolveAuthor(user.uid),
        ]);
        setPosts(p);
        setAuthorProfile(profile);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const totalLikes    = posts.reduce((a, p) => a + p.likes, 0);
  const totalComments = posts.reduce((a, p) => a + p.comments, 0);
  const totalViews    = posts.reduce((a, p) => a + p.views, 0);

  const handleReconnectDrive = async () => {
    setReconnecting(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token =
        (result as any)._tokenResponse?.oauthAccessToken ??
        (result as any).credential?.accessToken ?? "";
      if (token) {
        storeDriveToken(result.user.uid, token);
        setAccessToken(token);
        toast.success("Google Drive connected!");
      } else {
        toast.error("Couldn't retrieve Drive token. Try again.");
      }
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") toast.error("Drive connection failed");
    } finally {
      setReconnecting(false);
    }
  };

  const handleDisconnectDrive = () => {
    if (!user) return;
    localStorage.removeItem(`drive_token_${user.uid}`);
    setAccessToken(null);
    toast.success("Google Drive disconnected");
  };

  if (!user) return null;
  if (loading) return <PageLoader />;

  return (
    <main className="page min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to feed
        </Link>

        {/* Profile header bento */}
        <BentoGrid cols="grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" className="mb-6">
          <BentoTile
            colSpan="col-span-2 sm:col-span-4 lg:col-span-3"
            rowSpan="lg:row-span-2"
            className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 p-5 sm:p-8"
          >
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-4 ring-brand-100 dark:ring-brand-900/30">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand-50">
                  <User size={36} className="text-brand-400" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-primary">{displayName}</h1>
              <p className="text-sm text-gray-500 dark:text-dark-tertiary mt-0.5">{email}</p>
              <span className="mt-2 inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 capitalize">
                {userRole}
              </span>
            </div>
          </BentoTile>

          {[
            { icon: FileText,      label: "Posts",    value: posts.length,   color: "blue" as const },
            { icon: Heart,         label: "Likes",    value: totalLikes,     color: "red" as const },
            { icon: MessageCircle, label: "Comments", value: totalComments,  color: "purple" as const },
            { icon: Eye,           label: "Views",    value: totalViews,     color: "green" as const },
          ].map(({ icon: Icon, label, value, color }) => (
            <BentoTile
              key={label}
              colSpan="col-span-1 sm:col-span-2 lg:col-span-1"
              className="flex flex-col items-center justify-center text-center gap-2 p-4"
            >
              <div className={`p-3 rounded-xl ${colorMap[color]}`}>
                <Icon size={18} />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-dark-primary">{value.toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-dark-tertiary">{label}</p>
            </BentoTile>
          ))}

          <BentoTile
            colSpan="col-span-2 sm:col-span-2 lg:col-span-1"
            className="flex flex-col items-center justify-center text-center gap-2 p-4 cursor-pointer hover:border-brand-200 dark:hover:border-brand-800 transition-colors"
            onClick={() => router.push("/saved")}
          >
            <div className={`p-3 rounded-xl ${colorMap.orange}`}>
              <Bookmark size={18} />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-dark-primary">Saved</p>
            <p className="text-xs text-gray-400 dark:text-dark-tertiary">View your bookmarks</p>
          </BentoTile>
        </BentoGrid>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-dark-card rounded-xl p-1 mb-6 w-fit">
          {[
            { key: "posts", label: "My Posts",    icon: FileText  },
            { key: "drive", label: "Drive & Storage", icon: HardDrive },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white dark:bg-dark-bg shadow text-gray-900 dark:text-dark-primary"
                  : "text-gray-500 dark:text-dark-tertiary hover:text-gray-700 dark:hover:text-dark-secondary"
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "posts" && (
            <motion.div
              key="posts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {posts.length === 0 ? (
                <EmptyState
                  icon="✍️"
                  title="No posts yet"
                  description="Your published posts will appear here."
                  action={{ label: "Write your first post", href: "/compose" }}
                />
              ) : (
                <div className="space-y-4">
                  {posts.map((post, i) => (
                    <div key={post.id} className="relative">
                      {post.status !== "approved" && (
                        <div className={`absolute top-3 right-3 z-10 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          post.status === "pending"  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          post.status === "rejected" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-dark-tertiary"
                        }`}>
                          {post.status === "pending" ? "⏳ Pending review" : post.status === "rejected" ? "❌ Rejected" : post.status}
                        </div>
                      )}
                      <PostCard post={post} author={authorProfile} index={i} isSaved={savedIdSet.has(post.id)} />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "drive" && (
            <motion.div
              key="drive"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-6 space-y-6"
            >
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-dark-primary mb-1">
                  Image Storage
                </h2>
                <p className="text-sm text-gray-500 dark:text-dark-tertiary">
                  Images you upload in posts are saved to your Google Drive. Connect your account to enable Drive storage.
                </p>
              </div>

              {/* Status */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                accessToken
                  ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700/30"
                  : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-700/30"
              }`}>
                {accessToken ? (
                  <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${accessToken ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {accessToken ? "Google Drive connected" : "Google Drive not connected"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-dark-tertiary mt-0.5">
                    {accessToken
                      ? "Images will be uploaded to your Google Drive and displayed in your posts."
                      : "Without Drive access, images cannot be uploaded. Connect to enable image uploads."}
                  </p>
                </div>
              </div>

              {/* Account info */}
              {accessToken && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {photoURL ? (
                      <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-100">
                        <User size={14} className="text-brand-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-primary truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 dark:text-dark-tertiary truncate">{email}</p>
                  </div>
                  <span className="text-[11px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                    Active
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleReconnectDrive}
                  disabled={reconnecting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {reconnecting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw size={15} />
                    </motion.div>
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  {accessToken ? "Reconnect / Change Account" : "Connect Google Drive"}
                </button>

                {accessToken && (
                  <button
                    onClick={handleDisconnectDrive}
                    className="flex items-center gap-2 px-4 py-2.5 border border-red-200 dark:border-red-700/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-medium rounded-xl transition-colors"
                  >
                    <LogOut size={15} /> Disconnect
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                Google Drive tokens expire after ~1 hour. If images stop uploading, use "Reconnect" to get a fresh token.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
