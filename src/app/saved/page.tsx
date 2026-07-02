"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { getSavedPosts, resolveAuthor } from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile } from "@/types";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";

export default function SavedPage() {
  const router = useRouter();
  const { user, userRole } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [authorCache, setAuthorCache] = useState<Record<string, AuthorProfile | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userRole) {
      router.push("/");
      return;
    }

    (async () => {
      try {
        const savedPosts = await getSavedPosts(user.uid, userRole);
        setPosts(savedPosts);

        // Resolve authors
        const authorIds = Array.from(new Set(savedPosts.map((p) => p.authorId)));
        const resolved: Record<string, AuthorProfile | null> = {};
        await Promise.all(
          authorIds.map(async (id) => {
            resolved[id] = await resolveAuthor(id).catch(() => null);
          })
        );
        setAuthorCache(resolved);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid, userRole]);

  if (loading) return <PageLoader />;

  return (
    <main className="page min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <Link
          href="/"
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to feed
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <Bookmark size={28} className="text-brand-500" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-dark-primary">Saved Posts</h1>
            <p className="text-sm text-gray-500 dark:text-dark-tertiary mt-1">
              {posts.length} {posts.length === 1 ? "post" : "posts"} saved
            </p>
          </div>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No saved posts yet"
            description="Posts you bookmark will appear here."
            action={{ label: "Explore posts", href: "/" }}
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PostCard
                  post={post}
                  author={authorCache[post.authorId]}
                  index={i}
                  isSaved={true}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
