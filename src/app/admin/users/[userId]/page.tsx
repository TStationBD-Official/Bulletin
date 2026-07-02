"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, User, Activity } from "lucide-react";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  suspendUser,
  banUser,
  softDeleteUser,
  hardDeleteUser,
  reinstateUser,
  logAdminAction,
} from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { FeedsUser, Post } from "@/types";
import { formatDate, relativeTime } from "@/lib/utils";
import ConfirmModal from "@/components/admin/ConfirmModal";
import PostTable from "@/components/admin/PostTable";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { user } = useStore();

  const [userData, setUserData] = useState<FeedsUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, "feeds_user_only", userId));
        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }
        setUserData(userSnap.data() as FeedsUser);

        // Get user's posts
        const postsSnap = await getDocs(
          query(
            collection(db, "posts"),
            where("authorId", "==", userId),
            where("status", "==", "approved")
          )
        );
        setUserPosts(
          postsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Post))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleAction = async (action: string) => {
    if (!user || !userData) return;

    try {
      switch (action) {
        case "suspend":
          await suspendUser(userId, user.uid, "Admin suspension");
          break;
        case "ban":
          await banUser(userId, user.uid, "Policy violation");
          break;
        case "soft_delete":
          await softDeleteUser(userId, user.uid);
          break;
        case "hard_delete":
          await hardDeleteUser(userId, user.uid);
          break;
        case "reinstate":
          await reinstateUser(userId, user.uid);
          break;
      }
      toast.success(`User ${action.replace(/_/g, " ")} successfully!`);
      setConfirmAction(null);
      router.push("/admin/users");
    } catch {
      toast.error("Action failed");
    }
  };

  if (loading) return <PageLoader />;
  if (!userData) return <EmptyState icon="👤" title="User not found" />;

  const totalEngagement = userPosts.reduce(
    (acc, p) => acc + p.likes + p.comments + p.shares,
    0
  );
  const status = userData.status ?? "active";

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <Link
          href="/admin/users"
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to users
        </Link>

        {/* User card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-card p-8 mb-8"
        >
          <div className="flex items-start gap-6 mb-8">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              {userData.profileImageUrl ? (
                <img
                  src={userData.profileImageUrl}
                  alt={userData.name}
                  className="w-full h-full object-cover" referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/20">
                  <User size={32} className="text-purple-600 dark:text-purple-400" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{userData.name}</h1>
              <p className="text-gray-600 mt-1">{userData.email}</p>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                    status === "active"
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : status === "suspended"
                      ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  }`}
                >
                  {status}
                </span>
                <span className="text-xs text-gray-500">
                  Joined {formatDate(userData.createdAt)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {status === "active" && (
                <>
                  <button
                    onClick={() => setConfirmAction("suspend")}
                    className="px-4 py-2 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => setConfirmAction("ban")}
                    className="px-4 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Ban
                  </button>
                </>
              )}
              {(status === "suspended" || status === "banned") && (
                <button
                  onClick={() => setConfirmAction("reinstate")}
                  className="px-4 py-2 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Reinstate
                </button>
              )}
              <button
                onClick={() => setConfirmAction("soft_delete")}
                className="px-4 py-2 text-xs border border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              >
                Soft Delete
              </button>
              <button
                onClick={() => setConfirmAction("hard_delete")}
                className="px-4 py-2 text-xs border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Hard Delete
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {userPosts.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {totalEngagement.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Engagement</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {relativeTime(userData.lastLogin)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Last active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {userData.savedPosts?.length ?? 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Saved posts</p>
            </div>
          </div>
        </motion.div>

        {/* Posts section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-card p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={18} /> Posts by this user
          </h2>
          {userPosts.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No posts"
              description="This user hasn't created any approved posts."
              className="py-8"
            />
          ) : (
            <PostTable posts={userPosts} />
          )}
        </motion.div>
      </div>

      {/* Confirm modals */}
      {confirmAction === "suspend" && (
        <ConfirmModal
          title="Suspend User"
          description="The user will not be able to post or comment but can reactivate their account later."
          action="Suspend"
          isDangerous
          onConfirm={() => handleAction("suspend")}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "ban" && (
        <ConfirmModal
          title="Ban User"
          description="The user will be permanently banned and all their posts will be hidden. This action can be reversed."
          action="Ban"
          isDangerous
          onConfirm={() => handleAction("ban")}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "soft_delete" && (
        <ConfirmModal
          title="Soft Delete Account"
          description="The user's account will be marked as deleted but posts will remain in the system."
          action="Soft Delete"
          isDangerous
          onConfirm={() => handleAction("soft_delete")}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "hard_delete" && (
        <ConfirmModal
          title="Hard Delete Account"
          description="The user and all their data will be permanently deleted. This cannot be undone."
          action="Delete Everything"
          isDangerous
          requiresText="confirm"
          onConfirm={() => handleAction("hard_delete")}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "reinstate" && (
        <ConfirmModal
          title="Reinstate User"
          description="The user will be restored to active status."
          action="Reinstate"
          onConfirm={() => handleAction("reinstate")}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </main>
  );
}
