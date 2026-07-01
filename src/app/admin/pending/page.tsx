"use client";

import { useEffect, useState } from "react";
import { getDocs, query, collection, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { approvePost, rejectPost, resolveAuthor } from "@/lib/firestore";
import { getCategories, DEFAULT_CATEGORY } from "@/lib/categories";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile, Category } from "@/types";
import { relativeTime, truncate } from "@/lib/utils";
import RejectionModal from "@/components/admin/RejectionModal";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";

interface PendingPost {
  post: Post;
  author: AuthorProfile | null;
  selectedCategoryId: string;
}

export default function PendingPostsPage() {
  const { user } = useStore();
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

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
      // rejectPost already calls logAdminAction internally
      await rejectPost(rejectingId, user.uid, reason);
      setPendingPosts((p) => p.filter((x) => x.post.id !== rejectingId));
      toast.success("Post rejected!");
      setRejectingId(null);
    } catch {
      toast.error("Failed to reject post");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <main className="p-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Clock size={28} className="text-yellow-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-primary">Pending Posts</h1>
            <p className="text-gray-600 dark:text-dark-secondary mt-1">
              {pendingPosts.length} {pendingPosts.length === 1 ? "post" : "posts"} awaiting review
            </p>
          </div>
        </div>

        {pendingPosts.length === 0 ? (
          <EmptyState
            icon="✅"
            title="All caught up!"
            description="No pending posts to review."
            className="py-16"
          />
        ) : (
          <div className="space-y-4">
            {pendingPosts.map((item, i) => (
              <motion.div
                key={item.post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-5 hover:shadow-card transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {item.author?.profileImageUrl ? (
                      <img
                        src={item.author.profileImageUrl}
                        alt={item.author.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-primary">
                      {item.post.authorName}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                      {relativeTime(item.post.createdAt)}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-yellow-50 text-yellow-700 text-[11px] font-bold rounded-full">
                    PENDING
                  </span>
                </div>

                <p className="text-sm text-gray-700 dark:text-dark-secondary mb-4 line-clamp-3">
                  {truncate(item.post.content || "", 200)}
                </p>

                {/* Category selector */}
                {categories.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-dark-tertiary uppercase tracking-wide mb-1.5">
                      Category on Approval
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const active = item.selectedCategoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => updatePostCategory(item.post.id, cat.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border"
                            style={
                              active
                                ? { borderColor: cat.color, backgroundColor: cat.color + "18", color: cat.color }
                                : { borderColor: "#e5e7eb", color: "#9ca3af" }
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
                  <a
                    href={`/post/${item.post.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-xs border border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-secondary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
                  >
                    View Full
                  </a>
                  <button
                    onClick={() => handleApprove(item.post.id)}
                    disabled={approvingId === item.post.id}
                    className="px-3 py-2 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {approvingId === item.post.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => setRejectingId(item.post.id)}
                    className="px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {rejectingId && (
        <RejectionModal
          onConfirm={handleRejectSubmit}
          onCancel={() => setRejectingId(null)}
        />
      )}

    </main>
  );
}
