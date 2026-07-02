"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Heart, MessageCircle, Share2, ArrowLeft, Flag, User,
  Bookmark, Lock, Eye, Clock, Calendar,
} from "lucide-react";
import {
  getPost, resolveAuthor, isPostLiked, trackView,
  likePost, unlikePost, savePost, unsavePost, isPostSaved,
} from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile } from "@/types";
import { relativeTime, formatDate, readingTime, extractPlainText } from "@/lib/utils";
import CommentSection from "@/components/CommentSection";
import { PostImages } from "@/components/ImageGallery";
import FileAttachmentList from "@/components/FileAttachmentList";
import ShareModal from "@/components/ShareModal";
import ReportModal from "@/components/ReportModal";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";
import { QuillDeltaToHtmlConverter } from "quill-delta-to-html";
import { BentoGrid, BentoTile } from "@/components/BentoGrid";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useActionCooldown } from "@/hooks/useActionCooldown";

export default function PostPage() {
  const params = useParams();
  const postId = params.id as string;

  const { user, userRole, settings } = useStore();
  const allowSharing = settings?.allowSharing !== false;

  const [post,        setPost]        = useState<Post | null>(null);
  const [author,      setAuthor]      = useState<AuthorProfile | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [loading,     setLoading]     = useState(true);
  const [liked,       setLiked]       = useState(false);
  const [likeCount,   setLikeCount]   = useState(0);
  const [saved,       setSaved]       = useState(false);
  const [showShare,   setShowShare]   = useState(false);
  const [showReport,  setShowReport]  = useState(false);

  const barRef     = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  const likeCooldown = useActionCooldown();
  const saveCooldown  = useActionCooldown();

  /* ── Reading progress ─────────────────────────────────── */
  useEffect(() => {
    if (!barRef.current || !articleRef.current) return;

    gsap.set(barRef.current, { scaleX: 0 });

    const st = ScrollTrigger.create({
      trigger: articleRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => gsap.set(barRef.current, { scaleX: self.progress }),
    });

    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);

    return () => {
      st.kill();
      window.removeEventListener("load", onLoad);
    };
  }, [postId, post]);

  /* ── Load post ────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const p = await getPost(postId);
        if (!p) { setLoading(false); return; }
        setPost(p);
        setLikeCount(p.likes);

        if (p.richContent) {
          try {
            const converter = new QuillDeltaToHtmlConverter(
              JSON.parse(p.richContent), {}
            );
            setHtmlContent(converter.render());
          } catch {
            setHtmlContent(p.richContent);
          }
        } else {
          setHtmlContent(`<p>${p.content}</p>`);
        }

        const [auth, isLiked] = await Promise.all([
          resolveAuthor(p.authorId),
          user ? isPostLiked(postId, user.uid) : Promise.resolve(false),
        ]);
        setAuthor(auth);
        setLiked(isLiked);

        if (user && userRole) {
          trackView(postId, user.uid).catch(() => {});
          isPostSaved(postId, user.uid, userRole).then(setSaved).catch(() => {});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, user?.uid]);

  const handleLike = () => {
    if (!user) { toast.error("Sign in to like posts"); return; }
    likeCooldown(async () => {
      const next = !liked;
      setLiked(next);
      setLikeCount((c) => c + (next ? 1 : -1));
      setPost((p) => p ? { ...p, likes: p.likes + (next ? 1 : -1) } : null);
      try {
        if (next) await likePost(postId, user.uid);
        else await unlikePost(postId, user.uid);
      } catch {
        setLiked(!next);
        setLikeCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  const handleSave = () => {
    if (!user || !userRole) {
      toast.error("Sign in to save posts");
      return;
    }
    saveCooldown(async () => {
      const next = !saved;
      setSaved(next);
      try {
        if (next) await savePost(user.uid, postId, userRole);
        else await unsavePost(user.uid, postId, userRole);
        toast.success(next ? "Post saved!" : "Removed from saved");
      } catch (err: any) {
        setSaved(!next);
        toast.error(err?.message || "Couldn't update saved posts");
      }
    });
  };

  if (loading) return <PageLoader />;
  if (!post)   return <EmptyState icon="🔍" title="Post not found" />;

  const readMin = readingTime(
    extractPlainText(post.richContent ?? null, post.richContent ?? post.content ?? "")
  );

  return (
    <>
      {/* ── Reading progress bar ─────────────────────────── */}
      <div ref={barRef} className="reading-progress" />

      <main className="page min-h-screen bg-white dark:bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[56px_1fr] xl:grid-cols-[56px_1fr_260px] gap-8 items-start">

            {/* ── Floating left action bar (desktop) ─────── */}
            <div className="hidden lg:flex flex-col items-center gap-4 sticky top-28 pt-24">
              <motion.button
                whileTap={{ scale: 1.25 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                onClick={handleLike}
                title="Like"
                className={`flex flex-col items-center gap-1 p-2.5 rounded-full transition-colors ${
                  liked
                    ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                    : "text-gray-400 dark:text-dark-tertiary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                }`}
              >
                <Heart size={20} fill={liked ? "currentColor" : "none"} />
                {likeCount > 0 && (
                  <span className="text-[11px] font-semibold leading-none">{likeCount}</span>
                )}
              </motion.button>

              <button
                onClick={() => {
                  const el = document.getElementById("comments");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                title="Comments"
                className="flex flex-col items-center gap-1 p-2.5 rounded-full text-gray-400 dark:text-dark-tertiary hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              >
                <MessageCircle size={20} />
                {post.comments > 0 && (
                  <span className="text-[11px] font-semibold leading-none">{post.comments}</span>
                )}
              </button>

              {userRole && (
                <motion.button
                  whileTap={{ scale: 1.2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  onClick={handleSave}
                  title={saved ? "Remove from saved" : "Save"}
                  className={`p-2.5 rounded-full transition-colors ${
                    saved
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-gray-400 dark:text-dark-tertiary hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                  }`}
                >
                  <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
                </motion.button>
              )}

              {allowSharing && (
                <button
                  onClick={() => setShowShare(true)}
                  title="Share"
                  className="p-2.5 rounded-full text-gray-400 dark:text-dark-tertiary hover:text-gray-600 dark:hover:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                >
                  <Share2 size={20} />
                </button>
              )}

              {user && (
                <button
                  onClick={() => setShowReport(true)}
                  title="Report"
                  className="p-2.5 rounded-full text-gray-400 dark:text-dark-muted hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Flag size={18} />
                </button>
              )}
            </div>

            {/* ── Article ────────────────────────────────── */}
            <article ref={articleRef} className="min-w-0 reading-width w-full">
              {/* Back */}
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-dark-tertiary hover:text-gray-700 dark:hover:text-dark-primary transition-colors mb-8"
              >
                <ArrowLeft size={14} /> Back to feed
              </Link>

              {/* Category + visibility */}
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                {post.categoryName && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: (post.categoryColor ?? "#6366f1") + "18",
                      color: post.categoryColor ?? "#6366f1",
                    }}
                  >
                    {post.categoryIcon ?? "📌"} {post.categoryName}
                  </span>
                )}
                {post.visibility === "internal" && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <Lock size={11} /> Internal
                  </span>
                )}
              </div>

              {/* Title */}
              {post.title && (
                <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-dark-primary leading-tight tracking-tight mb-6">
                  {post.title}
                </h1>
              )}

              {/* Author + meta row */}
              <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-100 dark:border-dark-border">
                <Link href={`/author/${post.authorId}`} onClick={(e) => e.stopPropagation()}>
                  <motion.div
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.2 }}
                    className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0"
                  >
                    {author?.profileImageUrl ? (
                      <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                        <User size={18} className="text-brand-500" />
                      </div>
                    )}
                  </motion.div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/author/${post.authorId}`}
                    className="text-[14px] font-semibold text-gray-900 dark:text-dark-primary hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  >
                    {post.authorName}
                  </Link>
                  <div className="flex items-center gap-3 text-[12px] text-gray-400 dark:text-dark-tertiary mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(post.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {readMin} min read
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={11} /> {post.views.toLocaleString()} views
                    </span>
                  </div>
                </div>
              </div>

              {/* Featured image (first image if exists) */}
              {post.imageUrls?.[0] && !post.richContent && (
                <div className="mb-8 -mx-4 sm:-mx-0">
                  <img
                    src={post.imageUrls[0]}
                    alt={post.title || "Post image"}
                    className="w-full rounded-2xl object-cover max-h-[420px]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Article body */}
              <div
                className="article-body"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />

              {/* Additional images */}
              {post.imageUrls?.length > 0 && (
                <div className="mt-8">
                  <PostImages images={post.richContent ? post.imageUrls : post.imageUrls.slice(1)} />
                </div>
              )}

              {/* File attachments */}
              {post.fileAttachments && post.fileAttachments.length > 0 && (
                <div className="mt-8">
                  <FileAttachmentList files={post.fileAttachments} />
                </div>
              )}

              {/* ── Mobile action bar ─────────────────────── */}
              <div className="flex items-center gap-2 mt-8 pt-6 border-t border-gray-100 dark:border-dark-border lg:hidden flex-wrap">
                <motion.button
                  whileTap={{ scale: 1.15 }}
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    liked
                      ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                      : "text-gray-600 dark:text-dark-secondary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  }`}
                >
                  <Heart size={16} fill={liked ? "currentColor" : "none"} />
                  {likeCount > 0 ? likeCount : "Like"}
                </motion.button>

                {allowSharing && (
                  <button
                    onClick={() => setShowShare(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-600 dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                  >
                    <Share2 size={16} /> Share
                  </button>
                )}

                {userRole && (
                  <motion.button
                    whileTap={{ scale: 1.1 }}
                    onClick={handleSave}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      saved
                        ? "bg-brand-500 text-white shadow-sm"
                        : "text-gray-600 dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border"
                    }`}
                  >
                    <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
                    Save
                  </motion.button>
                )}

                {user && (
                  <button
                    onClick={() => setShowReport(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-400 dark:text-dark-tertiary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                  >
                    <Flag size={16} /> Report
                  </button>
                )}
              </div>

              {/* ── Author card ──────────────────────────── */}
              {author && (
                <BentoTile className="mt-10 flex items-start gap-3 sm:gap-4 bg-gray-50/60 dark:bg-dark-card/60 p-4 sm:p-6">
                  <Link href={`/author/${post.authorId}`}>
                    <motion.div
                      whileHover={{ scale: 1.06 }}
                      transition={{ duration: 0.2 }}
                      className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0"
                    >
                      {author.profileImageUrl ? (
                        <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                          <User size={22} className="text-brand-500" />
                        </div>
                      )}
                    </motion.div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-widest mb-1">Written by</p>
                    <Link
                      href={`/author/${post.authorId}`}
                      className="text-base font-bold text-gray-900 dark:text-dark-primary hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      {author.name}
                    </Link>
                    {(author as any).bio && (
                      <p className="text-sm text-gray-500 dark:text-dark-tertiary mt-1 leading-relaxed line-clamp-3">{(author as any).bio}</p>
                    )}
                  </div>
                </BentoTile>
              )}

              {/* ── Comments ─────────────────────────────── */}
              <div id="comments" className="mt-12">
                <CommentSection postId={postId} />
              </div>
            </article>

            {/* ── Right sidebar (xl only) ─────────────── */}
            <div className="hidden xl:block sticky top-28">
              <BentoGrid cols="grid-cols-2" className="gap-3">
                {[
                  { icon: <Heart size={14} />, label: "Likes", value: likeCount },
                  { icon: <MessageCircle size={14} />, label: "Comments", value: post.comments },
                  { icon: <Eye size={14} />, label: "Views", value: post.views },
                  { icon: <Share2 size={14} />, label: "Shares", value: post.shares },
                ].map(({ icon, label, value }) => (
                  <BentoTile key={label} className="flex flex-col items-center justify-center text-center gap-1.5 p-4">
                    <div className="text-gray-400 dark:text-dark-tertiary">{icon}</div>
                    <span className="text-lg font-bold text-gray-900 dark:text-dark-primary">{value.toLocaleString()}</span>
                    <span className="text-[11px] text-gray-400 dark:text-dark-tertiary">{label}</span>
                  </BentoTile>
                ))}
                <BentoTile bare colSpan="col-span-2" className="text-[12px] text-gray-400 dark:text-dark-tertiary space-y-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} /> Published {formatDate(post.createdAt)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} /> {readMin} min read
                  </div>
                </BentoTile>
              </BentoGrid>
            </div>
          </div>
        </div>
      </main>

      {showShare  && <ShareModal  postId={postId} onClose={() => setShowShare(false)} />}
      {showReport && <ReportModal postId={postId} postTitle={post?.title} onClose={() => setShowReport(false)} />}
    </>
  );
}

