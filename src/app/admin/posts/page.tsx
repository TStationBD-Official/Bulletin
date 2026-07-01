"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Search } from "lucide-react";
import { getAllPostsAdmin, hidePost, unhidePost, softDeletePost } from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { Post } from "@/types";
import PostTable from "@/components/admin/PostTable";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import ConfirmModal from "@/components/admin/ConfirmModal";
import toast from "react-hot-toast";

export default function PostsPage() {
  const { user } = useStore();
  const [posts, setPost] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    postId: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const allPosts = await getAllPostsAdmin();
        setPost(allPosts);
        setFilteredPosts(allPosts);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let results = posts;

    if (searchQuery) {
      results = results.filter(
        (p) =>
          p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.authorName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter) {
      results = results.filter((p) => p.status === statusFilter);
    }

    setFilteredPosts(results);
  }, [searchQuery, statusFilter, posts]);

  const handleAction = async (action: string, postId: string) => {
    if (!user) return;
    try {
      switch (action) {
        case "hide":
          await hidePost(postId, user.uid, "Admin action");
          break;
        case "unhide":
          await unhidePost(postId, user.uid);
          break;
        case "delete":
          await softDeletePost(postId, user.uid);
          break;
      }
      toast.success(`Post ${action}ed!`);
      setPost((p) => p.filter((x) => x.id !== postId));
      setConfirmAction(null);
    } catch {
      toast.error("Action failed");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <FileText size={28} className="text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Posts</h1>
            <p className="text-gray-600 mt-1">
              {posts.length} {posts.length === 1 ? "post" : "posts"} total
            </p>
          </div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Search content or author
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Table */}
        {filteredPosts.length === 0 ? (
          <EmptyState
            icon="📭"
            title={searchQuery || statusFilter ? "No posts found" : "No posts yet"}
            className="py-16"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <PostTable posts={filteredPosts} />
          </motion.div>
        )}
      </div>

      {confirmAction && (
        <ConfirmModal
          title={`${confirmAction.action.charAt(0).toUpperCase() + confirmAction.action.slice(1)} Post?`}
          description={`This action will ${confirmAction.action} the post.`}
          action={confirmAction.action.charAt(0).toUpperCase() + confirmAction.action.slice(1)}
          isDangerous={confirmAction.action === "delete"}
          onConfirm={() => handleAction(confirmAction.action, confirmAction.postId)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </main>
  );
}
