"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Heart, MessageCircle, Eye, Bookmark, Share2, Flag, User, Lock } from "lucide-react";
import { Post, AuthorProfile, Comment } from "@/types";
import { relativeTime, readingTime, extractFirstImage, extractPlainText } from "@/lib/utils";
import { likePost, unlikePost, savePost, unsavePost, sharePost, getRecentComments } from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { useActionCooldown } from "@/hooks/useActionCooldown";
import FileAttachmentList from "./FileAttachmentList";
import ShareModal from "./ShareModal";
import ReportModal from "./ReportModal";
import toast from "react-hot-toast";

interface PostCardProps {
  post: Post;
  author?: AuthorProfile | null;
  index?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  onLikeChange?: (liked: boolean) => void;
  onSaveChange?: (saved: boolean) => void;
  /** Skip the framer-motion mount animation when a scroll-triggered reveal (e.g. GSAP) drives this card instead */
  disableMountAnimation?: boolean;
}

export default function PostCard({
  post,
  author,
  index = 0,
  isLiked = false,
  isSaved = false,
  onLikeChange,
  onSaveChange,
  disableMountAnimation = false,
}: PostCardProps) {
  const router = useRouter();
  const { user, userRole, settings } = useStore();
  const allowSharing = settings?.allowSharing !== false;

  const [liked,   setLiked]   = useState(isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved,   setSaved]   = useState(isSaved);
  useEffect(() => setSaved(isSaved), [isSaved]);
  const [showShare,   setShowShare]   = useState(false);
  const [showReport,  setShowReport]  = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const likeCooldown  = useActionCooldown();
  const saveCooldown   = useActionCooldown();
  const shareCooldown  = useActionCooldown();

  const readMin  = readingTime(
    extractPlainText(post.richContent ?? null, post.richContent ?? post.content ?? "")
  );
  const preview  = (post.content || "").replace(/<[^>]*>/g, "").slice(0, 180).trim();
  const thumb    = extractFirstImage(post.imageUrls, post.richContent);
  const catColor = post.categoryColor ?? "#6366f1";

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.error("Sign in to like posts"); return; }
    likeCooldown(async () => {
      const next = !liked;
      setLiked(next);
      setLikeCount((c) => c + (next ? 1 : -1));
      onLikeChange?.(next);
      try {
        if (next) await likePost(post.id, user.uid);
        else await unlikePost(post.id, user.uid);
      } catch {
        setLiked(!next);
        setLikeCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user || !userRole) {
      toast.error("Sign in to save posts");
      return;
    }
    saveCooldown(async () => {
      const next = !saved;
      setSaved(next);
      onSaveChange?.(next);
      try {
        if (next) await savePost(user.uid, post.id, userRole);
        else await unsavePost(user.uid, post.id, userRole);
        toast.success(next ? "Saved!" : "Removed from saved");
      } catch (err: any) {
        setSaved(!next);
        toast.error(err?.message || "Couldn't update saved posts");
      }
    });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    shareCooldown(async () => {
      if (user) await sharePost(post.id, user.uid).catch(() => {});
      setShowShare(true);
    });
  };

  const handleToggleComments = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!showComments && comments.length === 0 && post.comments > 0) {
      setLoadingComments(true);
      try {
        setComments(await getRecentComments(post.id, 3));
      } catch {}
      finally { setLoadingComments(false); }
    }
    setShowComments((v) => !v);
  };

  const ArticleTag = disableMountAnimation ? "article" : motion.article;
  const articleMotionProps = disableMountAnimation
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <>
      <ArticleTag
        {...articleMotionProps}
        data-post-card
        onClick={() => router.push(`/post/${post.id}`)}
        className="group flex flex-col p-5 md:p-6 mb-3 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border cursor-pointer hover:border-gray-200 dark:hover:border-dark-border/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        {/* ── Header row: avatar + name/meta, bookmark+report top-right ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0 ring-1 ring-gray-100 dark:ring-dark-border">
              {author?.profileImageUrl ? (
                <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/30 dark:to-indigo-900/30">
                  <User size={15} className="text-brand-500" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/author/${post.authorId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[14px] font-bold text-gray-900 dark:text-dark-primary hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate block"
              >
                {post.authorName}
              </Link>
              <div className="flex items-center gap-1.5 flex-wrap text-[12px] text-gray-400 dark:text-dark-tertiary">
                <span>{relativeTime(post.createdAt)}</span>
                <span className="text-gray-200 dark:text-dark-muted">·</span>
                <span>{readMin} min read</span>
                {post.visibility === "internal" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                    <Lock size={8} /> Internal
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bookmark + report */}
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <motion.button
              whileTap={{ scale: 1.2 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              onClick={handleSave}
              title="Save"
              className={`p-1.5 rounded-lg transition-colors ${
                saved ? "bg-brand-500 text-white shadow-sm" : "text-gray-300 dark:text-dark-muted hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"
              }`}
            >
              <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
            </motion.button>

            {user && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReport(true); }}
                title="Report"
                className="p-1.5 rounded-lg text-gray-200 dark:text-dark-muted hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Flag size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="mt-3 flex flex-col gap-2">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-dark-primary leading-snug line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-200">
            {post.title || preview.slice(0, 80)}
          </h2>
          <p className="text-[14px] text-gray-500 dark:text-dark-tertiary leading-relaxed line-clamp-3">
            {preview}
          </p>
        </div>

        {/* ── Thumbnail (full width) ───────────────────────────── */}
        {thumb && (
          <div className="mt-3 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-border shadow-sm">
            <img
              src={thumb}
              alt={post.title || "Post image"}
              className="w-full max-h-64 object-cover group-hover:scale-[1.02] transition-transform duration-500"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* ── File attachments ─────────────────────────────────── */}
        {post.fileAttachments && post.fileAttachments.length > 0 && (
          <div className="mt-3">
            <FileAttachmentList files={post.fileAttachments} />
          </div>
        )}

        {/* ── Meta line: category + views ──────────────────────── */}
        <div className="flex items-center gap-2.5 mt-3 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: catColor + "18", color: catColor }}
          >
            {post.categoryIcon ?? "📌"} {post.categoryName ?? "General"}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-dark-tertiary">
            <Eye size={12} /> {post.views.toLocaleString()}
          </span>
        </div>

        {/* ── Footer: like / comment / share, evenly spaced ────── */}
        <div
          className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-dark-border/60 mt-3.5 pt-2.5 border-t border-gray-50 dark:border-dark-border/60"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            whileTap={{ scale: 1.15 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            onClick={handleLike}
            title="Like"
            className={`flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              liked ? "text-red-500" : "text-gray-500 dark:text-dark-tertiary hover:text-red-400"
            }`}
          >
            <Heart size={15} fill={liked ? "currentColor" : "none"} />
            {likeCount}
          </motion.button>

          <button
            onClick={handleToggleComments}
            title="Comments"
            className={`flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              showComments ? "text-brand-500" : "text-gray-500 dark:text-dark-tertiary hover:text-brand-400"
            }`}
          >
            <MessageCircle size={15} fill={showComments ? "currentColor" : "none"} />
            {post.comments}
          </button>

          {allowSharing ? (
            <button
              onClick={handleShare}
              title="Share"
              className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium rounded-lg text-gray-500 dark:text-dark-tertiary hover:text-gray-700 dark:hover:text-dark-secondary transition-colors"
            >
              <Share2 size={15} />
              {post.shares}
            </button>
          ) : (
            <span className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-gray-300 dark:text-dark-muted">
              <Share2 size={15} />
              {post.shares}
            </span>
          )}
        </div>

        {/* ── Inline comments ──────────────────────────────────── */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pt-4 mt-3 border-t border-gray-50 dark:border-dark-border/60 space-y-3">
                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full"
                    />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-dark-tertiary text-center py-2">No comments yet</p>
                ) : (
                  <>
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-dark-border flex-shrink-0 mt-0.5">
                          {c.userAvatar ? (
                            <img src={c.userAvatar} alt={c.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                              <User size={11} className="text-brand-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 bg-gray-50 dark:bg-dark-bg/60 rounded-xl px-3 py-2.5">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-[12px] font-semibold text-gray-800 dark:text-dark-primary">{c.userName}</span>
                            <span className="text-[11px] text-gray-400 dark:text-dark-tertiary">{relativeTime(c.createdAt)}</span>
                          </div>
                          <p className="text-[13px] text-gray-600 dark:text-dark-secondary leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    {post.comments > 3 && (
                      <Link
                        href={`/post/${post.id}#comments`}
                        onClick={(e) => e.stopPropagation()}
                        className="block text-center text-xs text-brand-500 hover:text-brand-600 font-semibold py-1 hover:underline underline-offset-2 transition-colors"
                      >
                        View all {post.comments} comments →
                      </Link>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ArticleTag>

      {showShare  && <ShareModal  postId={post.id} onClose={() => setShowShare(false)} />}
      {showReport && <ReportModal postId={post.id} postTitle={post.title} onClose={() => setShowReport(false)} />}
    </>
  );
}
