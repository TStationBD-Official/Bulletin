"use client";

import { useEffect, useState } from "react";
import { getDocs, query, collection, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { CheckCheck, Clock } from "lucide-react";
import {
  approvePost,
  rejectPost,
  resolveAuthor,
  logAdminAction,
} from "@/lib/firestore";
import { getCategories, DEFAULT_CATEGORY } from "@/lib/categories";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile, Category } from "@/types";
import { relativeTime, truncate } from "@/lib/utils";
import RejectionModal from "@/components/admin/RejectionModal";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface PendingPost {
  post: Post;
  author: AuthorProfile | null;
  selectedCategoryId: string;
}

export default function ApprovePage() {
  const { user, userRole, isAuthLoading } = useStore();
  const router = useRouter();
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && (!user || userRole !== "superAdmin")) {
      router.push("/");
    }
  }, [user?.uid, userRole, isAuthLoading, router]);

  useEffect(() => {
    if (isAuthLoading || !user || userRole !== "superAdmin") return;
    (async () => {
      try {
        const [snap, cats] = await Promise.all([
          getDocs(
            query(
              collection(db, "posts"),
              where("status", "==", "pending"),
              orderBy("createdAt", "asc")
            )
          ),
          getCategories().catch(() => []),
        ]);

        setCategories(cats);
        const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
        const withAuthors = await Promise.all(
          posts.map(async (post) => ({
            post,
            author: await resolveAuthor(post.authorId),
            selectedCategoryId: post.categoryId ?? DEFAULT_CATEGORY.id,
          }))
        );
        setPendingPosts(withAuthors);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthLoading, user?.uid, userRole]);

  const updatePostCategory = (postId: string, categoryId: string) => {
    setPendingPosts((prev) =>
      prev.map((item) =>
        item.post.id === postId ? { ...item, selectedCategoryId: categoryId } : item
      )
    );
  };

  const handleApprove = async (postId: string) => {
    if (!user) return;
    setApprovingId(postId);
    try {
      const item = pendingPosts.find((p) => p.post.id === postId);
      const cat = categories.find((c) => c.id === item?.selectedCategoryId);
      const categoryOverride = cat
        ? { categoryId: cat.id, categoryName: cat.name, categoryColor: cat.color, categoryIcon: cat.icon }
        : undefined;
      await approvePost(postId, user.uid, categoryOverride);
      setPendingPosts((p) => p.filter((x) => x.post.id !== postId));
      toast.success("Post approved!");
    } catch {
      toast.error("Failed to approve post");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectSubmit = async (reason: string, _description: string) => {
    if (!user || !rejectingId) return;
    try {
      await rejectPost(rejectingId, user.uid, reason);
      await logAdminAction({
        adminId: user.uid,
        action: "reject_post",
        targetId: rejectingId,
        targetType: "post",
        reason,
      });
      setPendingPosts((p) => p.filter((x) => x.post.id !== rejectingId));
      toast.success("Post rejected!");
      setRejectingId(null);
    } catch {
      toast.error("Failed to reject post");
    }
  };

  if (isAuthLoading || loading) return <PageLoader />;
  if (!user || userRole !== "superAdmin") return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Clock size={20} className="text-yellow-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-dark-primary">
            Pending Approval
          </h1>
        </div>

        {pendingPosts.length === 0 ? (
          <EmptyState
            icon="✅"
            title="All caught up!"
            description="No pending posts to review."
            className="py-20"
          />
        ) : (
          <div className="space-y-4">
            {pendingPosts.map((item, i) => (
              <motion.div
                key={item.post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-5 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
                    {item.author?.profileImageUrl && (
                      <img
                        src={item.author.profileImageUrl}
                        alt={item.author.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-dark-primary">
                      {item.post.authorName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                      {relativeTime(item.post.createdAt)}
                    </p>
                  </div>
                  <Link
                    href={`/post/${item.post.id}`}
                    className="text-[11px] text-brand-500 hover:underline"
                  >
                    View full
                  </Link>
                </div>

                <p className="text-sm text-gray-700 dark:text-dark-secondary mb-4 line-clamp-3">
                  {truncate(item.post.content || "", 200)}
                </p>

                {categories.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-dark-tertiary uppercase tracking-wide mb-1.5">
                      Category
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const active = item.selectedCategoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => updatePostCategory(item.post.id, cat.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                              active ? "" : "border-gray-200 dark:border-dark-border text-gray-400 dark:text-dark-muted"
                            }`}
                            style={
                              active
                                ? { borderColor: cat.color, backgroundColor: cat.color + "18", color: cat.color }
                                : undefined
                            }
                          >
                            {cat.icon} {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(item.post.id)}
                    disabled={approvingId === item.post.id}
                    className="flex-1 py-2 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {approvingId === item.post.id ? "Approving…" : "✓ Approve"}
                  </button>
                  <button
                    onClick={() => setRejectingId(item.post.id)}
                    className="flex-1 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {rejectingId && (
        <RejectionModal
          onConfirm={handleRejectSubmit}
          onCancel={() => setRejectingId(null)}
        />
      )}
    </div>
  );
}
