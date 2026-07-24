"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Heart, MessageCircle, Share2, ArrowLeft, Flag, User,
  Bookmark, Lock, Eye, Calendar, Clock, Globe, FileDown,
} from "lucide-react";
import {
  getPost, resolveAuthor, isPostLiked, trackView,
  likePost, unlikePost, savePost, unsavePost, isPostSaved, getRelatedPosts,
} from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile } from "@/types";
import { relativeTime, formatDate, readingTime, extractPlainText, quillImageAlignTagAttributes } from "@/lib/utils";
import CommentSection from "@/components/CommentSection";
import { PostImages } from "@/components/ImageGallery";
import FileAttachmentList from "@/components/FileAttachmentList";
import RelatedPostsCarousel from "@/components/RelatedPostsCarousel";
import ShareModal from "@/components/ShareModal";
import ReportModal from "@/components/ReportModal";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import AdsterraBanner from "@/components/ads/AdsterraBanner";
import AdsterraNativeBanner from "@/components/ads/AdsterraNativeBanner";
import toast from "react-hot-toast";
import { QuillDeltaToHtmlConverter } from "quill-delta-to-html";
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
  const [relatedPosts,   setRelatedPosts]   = useState<Post[]>([]);
  const [relatedAuthors, setRelatedAuthors] = useState<Record<string, AuthorProfile | null>>({});

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
            const parsed = JSON.parse(p.richContent);
            const converter = new QuillDeltaToHtmlConverter(parsed.ops ?? [], {
              customTagAttributes: quillImageAlignTagAttributes,
            });
            setHtmlContent(converter.convert());
          } catch (err) {
            console.error("Failed to render richContent for post", postId, "— falling back to plain content:", err);
            setHtmlContent(`<p>${p.content}</p>`);
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

        getRelatedPosts(p.categoryId ?? "general", postId).then(async (related) => {
          setRelatedPosts(related);
          const entries: Record<string, AuthorProfile | null> = {};
          await Promise.all(
            related.map(async (rp) => { entries[rp.authorId] = await resolveAuthor(rp.authorId).catch(() => null); })
          );
          setRelatedAuthors(entries);
        }).catch(() => {});
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[56px_1fr] xl:grid-cols-[56px_1fr_260px] gap-6 sm:gap-8 items-start">

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

              {userRole === "superAdmin" && (
                <a
                  href={`/post/${postId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download PDF"
                  className="p-2.5 rounded-full text-gray-400 dark:text-dark-tertiary hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                >
                  <FileDown size={20} />
                </a>
              )}
            </div>

            {/* ── Article ────────────────────────────────── */}
            <article ref={articleRef} className="min-w-0 reading-width w-full">
              {/* Back */}
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-dark-tertiary hover:text-gray-700 dark:hover:text-dark-primary transition-colors mb-5 sm:mb-8"
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
                {post.visibility === "internal" ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <Lock size={11} /> Internal
                  </span>
                ) : (
                  (userRole === "admin" || userRole === "student" || userRole === "guardian" || userRole === "superAdmin") && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                      <Globe size={11} /> Public
                    </span>
                  )
                )}
              </div>

              {/* Title */}
              {post.title && (
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-dark-primary leading-tight tracking-tight mb-4 sm:mb-6">
                  {post.title}
                </h1>
              )}

              {/* Author + meta row */}
              <div className="flex items-center gap-3.5 mb-6 pb-6 sm:mb-8 sm:pb-8 border-b border-gray-100 dark:border-dark-border">
                <Link href={`/author/${post.authorId}`} onClick={(e) => e.stopPropagation()}>
                  <motion.div
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.2 }}
                    className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0 ring-1 ring-gray-100 dark:ring-dark-border"
                  >
                    {author?.profileImageUrl ? (
                      <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                        <User size={19} className="text-brand-500" />
                      </div>
                    )}
                  </motion.div>
                </Link>
                <div className="min-w-0">
                  <Link
                    href={`/author/${post.authorId}`}
                    className="text-[15px] font-bold text-gray-900 dark:text-dark-primary hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  >
                    {post.authorName}
                  </Link>
                  <div className="flex items-center flex-wrap gap-x-1.5 text-[13px] text-gray-400 dark:text-dark-tertiary mt-0.5">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(post.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {readMin} min read</span>
                  </div>
                </div>
              </div>

              {/* In-content banner — natural gap between the author row and the article body */}
              <AdsterraBanner />

              {/* Featured image (first image if exists) */}
              {post.imageUrls?.[0] && !post.richContent && (
                <div className="mb-6 sm:mb-8">
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

              {/* Additional images — only for legacy posts without richContent;
                  when richContent exists, its images are already inline in the article body above */}
              {!post.richContent && post.imageUrls?.length > 1 && (
                <div className="mt-6 sm:mt-8">
                  <PostImages images={post.imageUrls.slice(1)} />
                </div>
              )}

              {/* File attachments */}
              {post.fileAttachments && post.fileAttachments.length > 0 && (
                <div className="mt-6 sm:mt-8">
                  <FileAttachmentList files={post.fileAttachments} />
                </div>
              )}

              {/* In-content native banner — gap after the article body, before the action bar/comments;
                  fluid width so it shows on mobile/tablet/lg. Hidden at xl since the sidebar shows
                  its own instance there instead — the ad unit's container id must be unique per page. */}
              <div className="mt-6 sm:mt-8 xl:hidden">
                <AdsterraNativeBanner />
              </div>

              {/* ── Mobile action bar ─────────────────────── */}
              <div
                className="grid gap-1 mt-6 sm:mt-8 pt-4 border-t border-gray-100 dark:border-dark-border lg:hidden"
                style={{ gridTemplateColumns: `repeat(${1 + (allowSharing ? 1 : 0) + (userRole ? 1 : 0) + (user ? 1 : 0) + (userRole === "superAdmin" ? 1 : 0)}, minmax(0, 1fr))` }}
              >
                <motion.button
                  whileTap={{ scale: 1.1 }}
                  onClick={handleLike}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-medium transition-colors ${
                    liked
                      ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                      : "text-gray-600 dark:text-dark-secondary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  }`}
                >
                  <Heart size={17} fill={liked ? "currentColor" : "none"} />
                  {likeCount > 0 ? likeCount : "Like"}
                </motion.button>

                {allowSharing && (
                  <button
                    onClick={() => setShowShare(true)}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-medium text-gray-600 dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                  >
                    <Share2 size={17} /> Share
                  </button>
                )}

                {userRole && (
                  <motion.button
                    whileTap={{ scale: 1.1 }}
                    onClick={handleSave}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-medium transition-colors ${
                      saved
                        ? "bg-brand-500 text-white shadow-sm"
                        : "text-gray-600 dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border"
                    }`}
                  >
                    <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
                    Save
                  </motion.button>
                )}

                {user && (
                  <button
                    onClick={() => setShowReport(true)}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-medium text-gray-400 dark:text-dark-tertiary hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Flag size={17} /> Report
                  </button>
                )}

                {userRole === "superAdmin" && (
                  <a
                    href={`/post/${postId}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-medium text-gray-600 dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                  >
                    <FileDown size={17} /> PDF
                  </a>
                )}
              </div>

              {/* ── Related posts (below the article on mobile/tablet/lg;
                  moves into the sidebar below Story stats at xl — see below) ── */}
              {relatedPosts.length > 0 && (
                <div className="mt-8 sm:mt-10 xl:hidden">
                  <RelatedPostsCarousel posts={relatedPosts} authors={relatedAuthors} />
                </div>
              )}

              {/* ── Comments ─────────────────────────────── */}
              <div id="comments" className="mt-8 sm:mt-12">
                <CommentSection postId={postId} />
              </div>
            </article>

            {/* ── Right sidebar (xl only) ─────────────── */}
            <div className="hidden xl:block sticky top-28">
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
                <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-widest px-5 pt-4 pb-2">
                  Story stats
                </p>
                <div className="divide-y divide-gray-100 dark:divide-dark-border">
                  {[
                    { icon: <Heart size={14} />, label: "Likes", value: likeCount },
                    { icon: <MessageCircle size={14} />, label: "Comments", value: post.comments },
                    { icon: <Eye size={14} />, label: "Views", value: post.views },
                    { icon: <Share2 size={14} />, label: "Shares", value: post.shares },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3">
                      <span className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-dark-tertiary">
                        {icon} {label}
                      </span>
                      <span className="text-[13px] font-bold text-gray-900 dark:text-dark-primary tabular-nums">
                        {value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related posts — desktop position, below Story stats */}
              {relatedPosts.length > 0 && (
                <div className="mt-6">
                  <RelatedPostsCarousel posts={relatedPosts} authors={relatedAuthors} />
                </div>
              )}

              {/* Sidebar native banner — fills the remaining gap below the sidebar content */}
              <div className="mt-6">
                <AdsterraNativeBanner />
              </div>
            </div>
          </div>
        </div>
      </main>

      {showShare  && <ShareModal  postId={postId} onClose={() => setShowShare(false)} />}
      {showReport && <ReportModal postId={postId} postTitle={post?.title} onClose={() => setShowReport(false)} />}
    </>
  );
}

