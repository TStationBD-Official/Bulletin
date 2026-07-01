"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { getAuthorPosts, resolveAuthor } from "@/lib/firestore";
import { Post, AuthorProfile } from "@/types";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";

export default function AuthorPage() {
  const params = useParams();
  const authorId = params.authorId as string;

  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [auth, authorPosts] = await Promise.all([
          resolveAuthor(authorId),
          getAuthorPosts(authorId),
        ]);
        setAuthor(auth);
        setPosts(authorPosts);
      } finally {
        setLoading(false);
      }
    })();
  }, [authorId]);

  if (loading) return <PageLoader />;
  if (!author) return <EmptyState icon="👤" title="Author not found" />;

  const totalEngagement = posts.reduce(
    (acc, p) => acc + p.likes + p.comments + p.shares,
    0
  );

  return (
    <main className="page min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href="/"
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to feed
        </Link>

        {/* Author card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-card rounded-2xl shadow-card p-5 sm:p-8 mb-8 text-center border border-gray-100 dark:border-dark-border"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
            className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 mx-auto mb-4"
          >
            {author.profileImageUrl ? (
              <img
                src={author.profileImageUrl}
                alt={author.name}
                className="w-full h-full object-cover" referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-brand-100">
                <User size={32} className="text-brand-500" />
              </div>
            )}
          </motion.div>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-dark-primary mb-1">{author.name}</h1>
          <p className="text-sm text-gray-500 dark:text-dark-tertiary mb-5 sm:mb-6">{author.email}</p>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-dark-primary">{posts.length}</p>
              <p className="text-xs text-gray-500 dark:text-dark-tertiary mt-1">Posts</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-dark-primary">
                {totalEngagement.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-tertiary mt-1">Engagement</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-dark-primary capitalize">
                {author.role}
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-tertiary mt-1">Role</p>
            </div>
          </div>
        </motion.div>

        {/* Posts */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-primary mb-4">All Posts</h2>

          {posts.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No posts yet"
              description={`${author.name} hasn't shared any posts yet.`}
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
                    author={author}
                    index={i}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
