"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Reply, Trash2, User, ChevronDown, ChevronUp } from "lucide-react";
import {
  subscribeToComments,
  addComment,
  addReply,
  deleteComment,
  deleteReply,
  getReplies,
  likeComment,
  checkRateLimit,
} from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { Comment, Reply as ReplyType } from "@/types";
import { relativeTime } from "@/lib/utils";
import toast from "react-hot-toast";
import LoadingSpinner from "./LoadingSpinner";

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { user, userData, settings } = useStore();

  if (settings && settings.allowComments === false) {
    return (
      <div className="text-center py-6 text-sm text-gray-400 dark:text-dark-tertiary border-t border-gray-100 dark:border-dark-border mt-4">
        Comments are currently disabled by the administrator.
      </div>
    );
  }
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToComments(postId, (c) => {
      setComments(c);
      setLoading(false);
    });
    return () => unsub();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    const { allowed } = await checkRateLimit(user.uid, "comment");
    if (!allowed) { toast.error("Daily comment limit reached"); return; }

    setSubmitting(true);
    try {
      const name = (userData as any)?.name ?? user.displayName ?? "Anonymous";
      const avatar = (userData as any)?.profileImageUrl ?? user.photoURL ?? null;
      await addComment(postId, user.uid, name, newComment.trim(), avatar);
      setNewComment("");
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-gray-900 dark:text-dark-primary mb-4">
        Comments ({comments.length})
      </h3>

      {/* Submit form */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-6 flex gap-3">
          {/* Current user avatar */}
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
            {((userData as any)?.profileImageUrl ?? user.photoURL) ? (
              <img
                src={(userData as any)?.profileImageUrl ?? user.photoURL}
                alt="You"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                <User size={16} className="text-brand-500" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment…"
              rows={2}
              className="w-full border border-gray-200 dark:border-dark-border rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-full hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Posting…" : "Post Comment"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-500 dark:text-dark-secondary mb-6 italic">
          Sign in to leave a comment.
        </p>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-dark-tertiary text-center py-8">
          No comments yet. Be the first!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  postId,
}: {
  comment: Comment;
  postId: string;
}) {
  const { user, userRole, userData } = useStore();
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ReplyType[]>([]);
  const [replyText, setReplyText] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [submitting, setSubmitting] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const canDelete =
    user && (comment.userId === user.uid || userRole === "superAdmin");

  const handleToggleReplies = async () => {
    if (!showReplies && replies.length === 0) {
      setLoadingReplies(true);
      try {
        const r = await getReplies(postId, comment.id);
        setReplies(r);
      } finally {
        setLoadingReplies(false);
      }
    }
    setShowReplies((v) => !v);
  };

  const handleLike = async () => {
    if (!user) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => c + (newLiked ? 1 : -1));
    await likeComment(postId, comment.id, user.uid).catch(() => {
      setLiked(!newLiked);
      setLikeCount((c) => c + (newLiked ? -1 : 1));
    });
  };

  const handleDelete = async () => {
    if (!user || !canDelete) return;
    await deleteComment(postId, comment.id);
    toast.success("Comment deleted");
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const name = (userData as any)?.name ?? user.displayName ?? "Anonymous";
      const avatar = (userData as any)?.profileImageUrl ?? user.photoURL ?? null;
      await addReply(
        postId,
        comment.id,
        user.uid,
        name,
        replyText.trim(),
        avatar
      );
      const newReply: ReplyType = {
        id: Date.now().toString(),
        userId: user.uid,
        userName: name,
        userAvatar: avatar ?? undefined,
        content: replyText.trim(),
        likes: 0,
        createdAt: { toDate: () => new Date() } as any,
      };
      setReplies((r) => [...r, newReply]);
      setReplyText("");
      setShowReplyForm(false);
      setShowReplies(true);
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0 flex items-center justify-center flex-shrink-0">
        {comment.userAvatar ? (
          <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
            <User size={14} className="text-brand-500" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 dark:bg-dark-card rounded-xl px-4 py-3 border border-gray-100 dark:border-dark-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-900 dark:text-dark-primary">
              {comment.userName}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-dark-tertiary">
              {relativeTime(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-dark-secondary">{comment.content}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5 px-1">
          <motion.button
            whileTap={{ scale: 1.2 }}
            transition={{ type: "spring", stiffness: 200 }}
            onClick={handleLike}
            className={`flex items-center gap-1 text-xs transition-colors ${
              liked ? "text-red-500" : "text-gray-400 dark:text-dark-tertiary hover:text-red-400 dark:hover:text-red-400"
            }`}
          >
            <Heart size={12} fill={liked ? "currentColor" : "none"} />
            {likeCount > 0 && likeCount}
          </motion.button>

          {user && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              className="text-xs text-gray-400 dark:text-dark-tertiary hover:text-brand-500 flex items-center gap-1 transition-colors"
            >
              <Reply size={12} /> Reply
            </button>
          )}

          {comment.replies > 0 && (
            <button
              onClick={handleToggleReplies}
              className="text-xs text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 transition-colors"
            >
              {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {comment.replies}{" "}
              {comment.replies === 1 ? "reply" : "replies"}
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              className="text-xs text-gray-300 dark:text-dark-muted hover:text-red-400 flex items-center gap-1 transition-colors ml-auto"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {/* Reply form */}
        <AnimatePresence>
          {showReplyForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleReply} className="mt-3 pb-1 pr-0.5 flex gap-2">
                {/* Replier avatar */}
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
                  {((userData as any)?.profileImageUrl ?? user?.photoURL) ? (
                    <img
                      src={(userData as any)?.profileImageUrl ?? user?.photoURL}
                      alt="You"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                      <User size={12} className="text-brand-500" />
                    </div>
                  )}
                </div>

                {/* Input + button */}
                <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${comment.userName}…`}
                    className="flex-1 text-xs text-gray-700 dark:text-dark-primary bg-transparent placeholder:text-gray-400 dark:placeholder:text-dark-tertiary focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || submitting}
                    className="flex-shrink-0 px-3 py-1 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "…" : "Send"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Replies */}
        <AnimatePresence>
          {showReplies && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-2 space-y-2 pl-3 border-l-2 border-gray-100 dark:border-dark-border overflow-hidden"
            >
              {loadingReplies ? (
                <div className="flex justify-center py-2">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                replies.map((reply) => (
                  <ReplyItem
                    key={reply.id}
                    reply={reply}
                    postId={postId}
                    commentId={comment.id}
                    onDelete={(id) =>
                      setReplies((r) => r.filter((x) => x.id !== id))
                    }
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReplyItem({
  reply,
  postId,
  commentId,
  onDelete,
}: {
  reply: ReplyType;
  postId: string;
  commentId: string;
  onDelete: (id: string) => void;
}) {
  const { user, userRole } = useStore();
  const canDelete =
    user && (reply.userId === user.uid || userRole === "superAdmin");

  const handleDelete = async () => {
    await deleteReply(postId, commentId, reply.id);
    onDelete(reply.id);
    toast.success("Reply deleted");
  };

  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
        {reply.userAvatar ? (
          <img src={reply.userAvatar} alt={reply.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
            <User size={10} className="text-brand-500" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="bg-gray-50 dark:bg-dark-card rounded-xl px-3 py-2 border border-gray-100 dark:border-dark-border">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] font-semibold text-gray-800 dark:text-dark-primary">
              {reply.userName}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-dark-tertiary">
              {relativeTime(reply.createdAt)}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-dark-secondary">{reply.content}</p>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            className="text-[11px] text-gray-300 dark:text-dark-tertiary hover:text-red-400 flex items-center gap-1 mt-1 transition-colors"
          >
            <Trash2 size={10} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
