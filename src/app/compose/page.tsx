"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Globe, Lock, AlertCircle, CheckCircle2, User,
  Send, HardDrive, RefreshCw, WifiOff, Info, ChevronDown, ChevronUp, Paperclip,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { QuillDeltaToHtmlConverter } from "quill-delta-to-html";
import { createPost, updatePost, getPost, checkRateLimit } from "@/lib/firestore";
import { quillImageAlignTagAttributes } from "@/lib/utils";
import { uploadImage, uploadFile } from "@/lib/drive";
import { getCategories, seedDefaultCategories, SEED_CATEGORIES, DEFAULT_CATEGORY } from "@/lib/categories";
import { Category, FileAttachment } from "@/types";
import FileAttachmentList from "@/components/FileAttachmentList";
import { useStore } from "@/store/useStore";
import { reconnectDrive, getValidDriveToken } from "@/lib/driveAuth";
import EmptyState from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import toast from "react-hot-toast";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

export default function ComposePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ComposePageInner />
    </Suspense>
  );
}

function ComposePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPostId = searchParams.get("edit");
  const { user, userRole, userData, accessToken, settings, setAccessToken } = useStore();

  const [editLoaded, setEditLoaded] = useState(!editPostId);

  const [title,           setTitle]           = useState("");
  const [htmlContent,     setHtmlContent]     = useState("");
  const [deltaContent,    setDeltaContent]    = useState("");
  const [plainText,       setPlainText]       = useState("");
  const [visibility,      setVisibility]      = useState<"public" | "internal">("public");
  const [submitting,      setSubmitting]      = useState(false);
  const [reconnecting,    setReconnecting]    = useState(false);
  const [titleFocused,    setTitleFocused]    = useState(false);
  const [showSettings,    setShowSettings]    = useState(false); // mobile settings toggle

  const [categories,         setCategories]         = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(DEFAULT_CATEGORY.id);
  const [rateLimitChecked,   setRateLimitChecked]   = useState(false);
  const [rateLimited,        setRateLimited]        = useState(false);
  const [postsRemaining,     setPostsRemaining]     = useState<number | null>(null);
  const [maxPostsPerDay,     setMaxPostsPerDay]      = useState(10);

  const [attachments,    setAttachments]    = useState<FileAttachment[]>([]);
  const [uploadingFile,  setUploadingFile]  = useState(false);

  const roleLoading = user && !userRole;
  const userName    = (userData as any)?.name ?? user?.displayName ?? "Unknown";
  const photoURL    = (userData as any)?.profileImageUrl ?? user?.photoURL ?? null;

  // Derived flags
  const showVisibility  = userRole === "admin" || userRole === "student" || userRole === "guardian";
  const isAdmin         = userRole === "admin" || userRole === "superAdmin";
  const requireApprovalFor    = settings?.requireApprovalFor ?? "website_users_only";
  const autoApproveAdminPosts = settings?.autoApproveAdminPosts ?? true;
  const autoApproved =
    requireApprovalFor === "none" ||
    (requireApprovalFor === "website_users_only" && userRole !== "feeds_user") ||
    (isAdmin && autoApproveAdminPosts);

  const adminGroupId: string | undefined =
    userRole === "admin" || userRole === "superAdmin"
      ? user?.uid
      : (userData as any)?.adminId ?? undefined;

  const internalDescription =
    userRole === "admin"
      ? "Visible only to you and your students"
      : "Visible only to your teacher and classmates";

  const charCount    = plainText.length;
  const selectedCat  = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const canSubmit    = !submitting && !rateLimited && plainText.length >= 10;

  useEffect(() => {
    if (!user) return;
    setMaxPostsPerDay(settings?.maxPostsPerDay ?? 10);
    (async () => {
      try {
        // Editing an existing post doesn't count against the daily new-post limit
        const [{ allowed, remaining }, cats] = await Promise.all([
          editPostId ? Promise.resolve({ allowed: true, remaining: maxPostsPerDay }) : checkRateLimit(user.uid, "post"),
          getCategories().catch(() => []),
        ]);
        setRateLimited(!allowed);
        setPostsRemaining(remaining);
        if (cats.length > 0) {
          setCategories(cats);
        } else {
          setCategories(SEED_CATEGORIES as any);
          seedDefaultCategories(user.uid).catch(() => {});
        }
      } finally {
        setRateLimitChecked(true);
      }
    })();
  }, [user?.uid]);

  // Load the existing post when editing (?edit=<postId>) and prefill the form
  useEffect(() => {
    if (!editPostId || !user) return;
    (async () => {
      try {
        const p = await getPost(editPostId);
        if (!p || p.authorId !== user.uid || (p.status !== "pending" && p.status !== "rejected")) {
          toast.error("This post can no longer be edited.");
          router.replace("/profile");
          return;
        }
        setTitle(p.title ?? "");
        setDeltaContent(p.richContent ?? "");
        setPlainText((p.content ?? "").replace(/<[^>]*>/g, "").trim());
        try {
          const parsed = JSON.parse(p.richContent ?? "{}");
          const converter = new QuillDeltaToHtmlConverter(parsed.ops ?? [], {
            customTagAttributes: quillImageAlignTagAttributes,
          });
          setHtmlContent(converter.convert());
        } catch {
          setHtmlContent(`<p>${p.content ?? ""}</p>`);
        }
        setVisibility(p.visibility);
        setSelectedCategoryId(p.categoryId ?? DEFAULT_CATEGORY.id);
        setAttachments(p.fileAttachments ?? []);
      } catch {
        toast.error("Couldn't load post for editing.");
        router.replace("/profile");
      } finally {
        setEditLoaded(true);
      }
    })();
  }, [editPostId, user?.uid]);

  const handleEditorChange = (html: string, _delta: any, _source: string, editor: any) => {
    setHtmlContent(html);
    try {
      setDeltaContent(JSON.stringify(editor.getContents()));
      setPlainText(editor.getText().trim());
    } catch {
      setPlainText(html.replace(/<[^>]*>/g, "").trim());
    }
  };

  const handleReconnectDrive = async () => {
    if (!user) return;
    setReconnecting(true);
    try {
      const token = await reconnectDrive(user.uid);
      setAccessToken(token);
      toast.success("Google Drive reconnected!");
    } catch (err: any) {
      toast.error("Could not reconnect Drive. Please try signing out and back in.");
    } finally {
      setReconnecting(false);
    }
  };

  // Silently refreshes the Drive token if it's stale before any upload, so
  // users aren't asked to manually "reconnect" just because time passed —
  // the background 50-min refresh interval in useAuth.ts can lag or miss a
  // beat (throttled/backgrounded tabs), so we re-check right before use too.
  const ensureFreshAccessToken = async (): Promise<string | null> => {
    if (!user) return null;
    const fresh = await getValidDriveToken(user.uid);
    if (fresh && fresh !== accessToken) setAccessToken(fresh);
    return fresh;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file later
    if (files.length === 0) return;

    if (!accessToken) {
      toast.error("Connect Google Drive to attach files");
      return;
    }

    const rejected = files.filter((f) => !ALLOWED_ATTACHMENT_TYPES.includes(f.type));
    const valid = files.filter((f) => ALLOWED_ATTACHMENT_TYPES.includes(f.type));
    if (rejected.length > 0) {
      toast.error(`Unsupported file type: ${rejected.map((f) => f.name).join(", ")}`);
    }
    if (valid.length === 0) return;

    setUploadingFile(true);
    try {
      const token = (await ensureFreshAccessToken()) ?? accessToken;
      if (!token) {
        toast.error("Google Drive session expired. Click Reconnect and try again.");
        return;
      }
      for (const file of valid) {
        try {
          const { url } = await uploadFile(file, token, `tmp_${Date.now()}`);
          setAttachments((prev) => [...prev, { url, name: file.name, mimeType: file.type, size: file.size }]);
        } catch (err: any) {
          console.error(`Failed to upload ${file.name}:`, err);
          toast.error(err?.message ? `Failed to upload ${file.name}: ${err.message}` : `Failed to upload ${file.name}`);
        }
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRenameAttachment = (index: number, name: string) => {
    setAttachments((prev) => prev.map((a, i) => (i === index ? { ...a, name } : a)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (plainText.length < 10) {
      toast.error("Post must have at least 10 characters");
      return;
    }
    const keywords = settings?.moderationKeywords ?? [];
    if (keywords.length > 0) {
      const lower = (title + " " + plainText).toLowerCase();
      const hit = keywords.find((kw) => lower.includes(kw.toLowerCase()));
      if (hit) {
        toast.error(`Your post contains a restricted word: "${hit}". Please edit and resubmit.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      let remaining = postsRemaining ?? 0;
      if (!editPostId) {
        const rl = await checkRateLimit(user!.uid, "post");
        remaining = rl.remaining;
        if (!rl.allowed) {
          toast.error(`Daily post limit of ${maxPostsPerDay} reached`);
          setRateLimited(true);
          setPostsRemaining(0);
          return;
        }
      }

      let cleanDelta = deltaContent;
      {
        const delta = JSON.parse(deltaContent);
        let changed = false;
        const ops = delta.ops ?? [];
        const dataImageCount = ops.filter(
          (op: any) => typeof op.insert?.image === "string" && op.insert.image.startsWith("data:")
        ).length;
        const imageToken = dataImageCount > 0 ? (await ensureFreshAccessToken()) ?? accessToken : accessToken;
        if (dataImageCount > 0 && !imageToken) {
          throw new Error("Google Drive session expired. Click Reconnect and try again.");
        }

        const uploadErrors: string[] = [];
        await Promise.all(
          ops.map(async (op: any, i: number) => {
            if (typeof op.insert?.image === "string" && op.insert.image.startsWith("data:")) {
              try {
                const [header, b64] = op.insert.image.split(",");
                const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
                const bytes = atob(b64);
                const arr = new Uint8Array(bytes.length);
                for (let j = 0; j < bytes.length; j++) arr[j] = bytes.charCodeAt(j);
                const file = new File([arr], `img_${i}.${mime.split("/")[1] ?? "png"}`, { type: mime });
                const url = await uploadImage(file, imageToken, `tmp_${Date.now()}_${i}`);
                ops[i] = { ...op, insert: { image: url } };
                changed = true;
              } catch {
                uploadErrors.push(`Image ${i + 1}`);
              }
            }
          })
        );
        if (uploadErrors.length > 0) {
          throw new Error(`Failed to upload: ${uploadErrors.join(", ")}. Please remove or retry them.`);
        }
        if (changed) cleanDelta = JSON.stringify({ ...delta, ops });
      }

      const imageUrls: string[] = [];
      try {
        const delta = JSON.parse(cleanDelta);
        delta.ops?.forEach((op: any) => {
          if (op.insert?.image && !op.insert.image.startsWith("data:")) imageUrls.push(op.insert.image);
        });
      } catch {}

      if (editPostId) {
        await updatePost(editPostId, {
          authorName: userName,
          title: title.trim() || undefined,
          content: plainText.slice(0, 500),
          richContent: cleanDelta,
          imageUrls,
          fileAttachments: attachments,
          visibility: showVisibility ? visibility : "public",
          status: autoApproved ? "approved" : "pending",
          adminId: autoApproved ? user!.uid : undefined,
          adminGroupId: showVisibility && visibility === "internal" ? adminGroupId : undefined,
          categoryId: selectedCat?.id ?? DEFAULT_CATEGORY.id,
          categoryName: selectedCat?.name ?? DEFAULT_CATEGORY.name,
          categoryColor: selectedCat?.color ?? DEFAULT_CATEGORY.color,
          categoryIcon: selectedCat?.icon ?? DEFAULT_CATEGORY.icon,
        });

        toast.success(
          autoApproved ? "Post updated and published! 🎉" : "Post updated — submitted for review again 📋",
          { duration: 5000 }
        );
        router.push(`/post/${editPostId}`);
        return;
      }

      const postId = await createPost({
        authorId: user!.uid,
        authorName: userName,
        title: title.trim() || undefined,
        content: plainText.slice(0, 500),
        richContent: cleanDelta,
        imageUrls,
        fileAttachments: attachments,
        visibility: showVisibility ? visibility : "public",
        status: autoApproved ? "approved" : "pending",
        adminId: autoApproved ? user!.uid : undefined,
        adminGroupId: showVisibility && visibility === "internal" ? adminGroupId : undefined,
        categoryId: selectedCat?.id ?? DEFAULT_CATEGORY.id,
        categoryName: selectedCat?.name ?? DEFAULT_CATEGORY.name,
        categoryColor: selectedCat?.color ?? DEFAULT_CATEGORY.color,
        categoryIcon: selectedCat?.icon ?? DEFAULT_CATEGORY.icon,
      });

      setPostsRemaining(Math.max(0, remaining - 1));
      toast.success(autoApproved ? "Post published! 🎉" : "Submitted for review! 📋", { duration: 5000 });
      router.push(`/post/${postId}`);
    } catch (err: any) {
      console.error("Failed to save post:", err);
      const verb = editPostId ? "update" : "create";
      toast.error(err?.message ? `Failed to ${verb} post: ${err.message}` : `Failed to ${verb} post. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (roleLoading) return <PageLoader />;

  if (!user) {
    return (
      <main className="page min-h-screen bg-white dark:bg-dark-bg">
        <div className="max-w-2xl mx-auto px-4 py-24">
          <EmptyState
            icon="🔐"
            title="Sign in to write"
            description="You need to be signed in to create posts."
            action={{ label: "Back to feed", href: "/" }}
          />
        </div>
      </main>
    );
  }

  if (!rateLimitChecked || !editLoaded) return <PageLoader />;

  return (
    <main className="page min-h-screen bg-white dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* ── Top bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between h-14 border-b border-gray-100 dark:border-dark-border">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-tertiary hover:text-gray-900 dark:hover:text-dark-primary transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </Link>

          <span className="text-sm text-gray-400 dark:text-dark-muted font-medium">{editPostId ? "Edit Post" : "New Post"}</span>
        </div>

        {/* ── Drive reconnect banner (mobile + when disconnected) ── */}
        <AnimatePresence>
          {!accessToken && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2.5">
                  <WifiOff size={15} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">Google Drive not connected</span>
                    <span className="hidden sm:inline text-amber-600 dark:text-amber-500"> — images won't upload until you reconnect.</span>
                  </p>
                </div>
                <button
                  onClick={handleReconnectDrive}
                  disabled={reconnecting}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                >
                  {reconnecting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {reconnecting ? "Connecting…" : "Reconnect"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Alerts ───────────────────────────────────────────── */}
        <AnimatePresence>
          {rateLimited && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
            >
              <AlertCircle size={17} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Daily limit reached</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                  You've used all {maxPostsPerDay} posts for today. Come back tomorrow!
                </p>
              </div>
            </motion.div>
          )}
          {!rateLimited && postsRemaining !== null && postsRemaining <= 3 && postsRemaining > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3"
            >
              <Info size={15} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>{postsRemaining}</strong> post{postsRemaining !== 1 ? "s" : ""} remaining today.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main editor layout ────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-0 lg:gap-10 py-8">

            {/* ── Left: Editor ──────────────────────────────────── */}
            <div className="min-w-0">
              {/* Title */}
              <div className="mb-6">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={() => setTitleFocused(true)}
                  onBlur={() => setTitleFocused(false)}
                  placeholder="Title (optional)"
                  maxLength={120}
                  className="w-full text-3xl md:text-4xl font-black text-gray-900 dark:text-dark-primary placeholder:text-gray-200 dark:placeholder:text-dark-border bg-transparent border-none outline-none leading-tight tracking-tight py-1"
                />
                {title.length > 0 && (
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="h-0.5 flex-1 bg-gray-100 dark:bg-dark-border rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-brand-500 rounded-full"
                        animate={{ width: `${(title.length / 120) * 100}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                    <span className="ml-3 text-xs text-gray-400 dark:text-dark-tertiary flex-shrink-0">{title.length}/120</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-dark-border mb-6" />

              {/* Rich text editor */}
              <div>
                <div className={`rounded-2xl overflow-hidden border transition-all duration-200 ${
                  "border-gray-200 dark:border-dark-border focus-within:border-brand-400 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                }`}>
                  <RichTextEditor
                    value={htmlContent}
                    onChange={handleEditorChange}
                    placeholder="Tell your story… use rich formatting, add images, embed links."
                    postId={user.uid}
                    minHeight={420}
                  />
                </div>

                {/* Editor meta row */}
                <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                  <p className="text-[12px] text-gray-400 dark:text-dark-tertiary">
                    Drag & drop or paste images — they upload automatically to Drive.
                  </p>
                  <AnimatePresence>
                    {charCount > 0 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full ${
                          charCount < 10
                            ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                            : "bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-dark-tertiary"
                        }`}
                      >
                        {charCount < 10 ? `${10 - charCount} more chars needed` : `${charCount.toLocaleString()} chars`}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Mobile: Settings toggle ──────────────────────── */}
              <div className="lg:hidden mt-8 border-t border-gray-100 dark:border-dark-border pt-6">
                <button
                  type="button"
                  onClick={() => setShowSettings((v) => !v)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 dark:text-dark-secondary"
                >
                  <span>Post Settings</span>
                  {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6">
                        <SidebarContent
                          categories={categories}
                          selectedCategoryId={selectedCategoryId}
                          setSelectedCategoryId={setSelectedCategoryId}
                          selectedCat={selectedCat}
                          showVisibility={showVisibility}
                          visibility={visibility}
                          setVisibility={setVisibility}
                          internalDescription={internalDescription}
                          autoApproved={autoApproved}
                          submitting={submitting}
                          rateLimited={rateLimited}
                          canSubmit={canSubmit}
                          settings={settings}
                          photoURL={photoURL}
                          userName={userName}
                          accessToken={accessToken}
                          reconnecting={reconnecting}
                          onReconnectDrive={handleReconnectDrive}
                          attachments={attachments}
                          uploadingFile={uploadingFile}
                          onFileSelect={handleFileSelect}
                          onRemoveAttachment={handleRemoveAttachment}
                          onRenameAttachment={handleRenameAttachment}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile submit */}
                <div className="mt-6 flex gap-3">
                  <Link
                    href="/"
                    className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-dark-border text-sm font-semibold text-gray-600 dark:text-dark-secondary text-center hover:bg-gray-50 dark:hover:bg-dark-card transition-colors"
                  >
                    Cancel
                  </Link>
                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.02 } : {}}
                    whileTap={canSubmit ? { scale: 0.97 } : {}}
                    className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-dark-primary text-white dark:text-dark-bg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {submitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white dark:border-dark-bg border-t-transparent rounded-full"
                        />
                        {editPostId ? "Saving…" : autoApproved ? "Publishing…" : "Submitting…"}
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        {editPostId ? "Save" : autoApproved ? "Publish" : "Submit"}
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* ── Right: Sidebar (desktop only) ─────────────────── */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <SidebarContent
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  setSelectedCategoryId={setSelectedCategoryId}
                  selectedCat={selectedCat}
                  showVisibility={showVisibility}
                  visibility={visibility}
                  setVisibility={setVisibility}
                  internalDescription={internalDescription}
                  autoApproved={autoApproved}
                  submitting={submitting}
                  rateLimited={rateLimited}
                  canSubmit={canSubmit}
                  settings={settings}
                  photoURL={photoURL}
                  userName={userName}
                  accessToken={accessToken}
                  reconnecting={reconnecting}
                  onReconnectDrive={handleReconnectDrive}
                  attachments={attachments}
                  uploadingFile={uploadingFile}
                  onFileSelect={handleFileSelect}
                  onRemoveAttachment={handleRemoveAttachment}
                  onRenameAttachment={handleRenameAttachment}
                />

                {/* Action buttons */}
                <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-dark-border">
                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.02 } : {}}
                    whileTap={canSubmit ? { scale: 0.97 } : {}}
                    className="w-full py-3 rounded-xl bg-gray-900 dark:bg-dark-primary text-white dark:text-dark-bg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors hover:bg-gray-700 dark:hover:bg-gray-200"
                  >
                    {submitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white dark:border-dark-bg border-t-transparent rounded-full"
                        />
                        {editPostId ? "Saving changes…" : autoApproved ? "Publishing…" : "Submitting…"}
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        {editPostId ? "Save Changes" : autoApproved ? "Publish Post" : "Submit for Review"}
                      </>
                    )}
                  </motion.button>

                  <Link
                    href="/"
                    className="block w-full py-3 rounded-xl border border-gray-200 dark:border-dark-border text-sm font-semibold text-gray-600 dark:text-dark-secondary text-center hover:bg-gray-50 dark:hover:bg-dark-card transition-colors"
                  >
                    Cancel
                  </Link>

                  {settings?.communityGuidelines?.trim() && (
                    <p className="text-[11px] text-gray-400 dark:text-dark-tertiary text-center leading-relaxed pt-1">
                      By posting you agree to our{" "}
                      <a href="/guidelines" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-500 transition-colors">
                        Community Guidelines
                      </a>
                      {settings?.termsOfService?.trim() && (
                        <> and{" "}
                          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-500 transition-colors">
                            Terms
                          </a>
                        </>
                      )}
                      .
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ── Sidebar content (shared between desktop & mobile) ───── */
interface SidebarContentProps {
  categories: Category[];
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  selectedCat: Category | null;
  showVisibility: boolean;
  visibility: "public" | "internal";
  setVisibility: (v: "public" | "internal") => void;
  internalDescription: string;
  autoApproved: boolean;
  submitting: boolean;
  rateLimited: boolean;
  canSubmit: boolean;
  settings: any;
  /* author + drive */
  photoURL: string | null;
  userName: string;
  accessToken: string | null;
  reconnecting: boolean;
  onReconnectDrive: () => void;
  /* attachments */
  attachments: FileAttachment[];
  uploadingFile: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
  onRenameAttachment: (index: number, name: string) => void;
}

function SidebarContent({
  categories, selectedCategoryId, setSelectedCategoryId, selectedCat,
  showVisibility, visibility, setVisibility, internalDescription,
  autoApproved, photoURL, userName, accessToken, reconnecting, onReconnectDrive,
  attachments, uploadingFile, onFileSelect, onRemoveAttachment, onRenameAttachment,
}: SidebarContentProps) {
  return (
    <div className="space-y-6">

      {/* ── Author card ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-dark-card-2 rounded-2xl border border-gray-100 dark:border-dark-border">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0 ring-2 ring-white dark:ring-dark-card shadow-sm">
          {photoURL ? (
            <img src={photoURL} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
              <User size={16} className="text-brand-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-dark-primary truncate">{userName}</p>
          <p className="text-[11px] text-gray-400 dark:text-dark-muted mt-0.5">Posting as you</p>
        </div>
      </div>

      {/* ── Drive connection status ──────────────────────────── */}
      {accessToken ? (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <HardDrive size={14} className="text-green-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] font-bold text-green-700 dark:text-green-400">Drive connected</p>
            <p className="text-[11px] text-green-600 dark:text-green-500 mt-0.5">Images upload automatically</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
          <WifiOff size={14} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">Drive disconnected</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">Images won't upload</p>
          </div>
          <button
            type="button"
            onClick={onReconnectDrive}
            disabled={reconnecting}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-60"
          >
            {reconnecting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <RefreshCw size={11} />
            )}
            {reconnecting ? "…" : "Reconnect"}
          </button>
        </div>
      )}

      {/* ── Attachments ───────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-widest mb-3">
          Attachments
        </p>
        {attachments.length > 0 && (
          <FileAttachmentList
            files={attachments}
            onRemove={onRemoveAttachment}
            onRename={onRenameAttachment}
            className="mb-2.5"
          />
        )}
        <label
          className={`flex items-center justify-center text-center gap-2 px-3.5 py-2.5 rounded-xl border-2 border-dashed text-[12px] font-semibold cursor-pointer transition-colors flex-wrap ${
            uploadingFile
              ? "border-gray-200 dark:border-dark-border text-gray-300 dark:text-dark-muted cursor-not-allowed"
              : "border-gray-200 dark:border-dark-border text-gray-500 dark:text-dark-tertiary hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/10"
          }`}
        >
          {uploadingFile ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full flex-shrink-0"
            />
          ) : (
            <Paperclip size={14} className="flex-shrink-0" />
          )}
          <span>{uploadingFile ? "Uploading…" : "Attach PDF, Word, Excel, PowerPoint or text file"}</span>
          <input
            type="file"
            multiple
            accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain"
            onChange={onFileSelect}
            disabled={uploadingFile}
            className="hidden"
          />
        </label>
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-widest mb-3">
            Category
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {categories.map((cat) => {
              const selected = selectedCategoryId === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all overflow-hidden ${!selected ? "bg-gray-50 dark:bg-dark-card-2" : ""}`}
                  style={
                    selected
                      ? { borderColor: cat.color, backgroundColor: cat.color + "12" }
                      : { borderColor: "transparent" }
                  }
                >
                  <span className="text-base leading-none flex-shrink-0">{cat.icon}</span>
                  <span
                    className={`text-[12px] font-semibold leading-tight line-clamp-1 ${!selected ? "text-gray-500 dark:text-dark-tertiary" : ""}`}
                    style={selected ? { color: cat.color } : undefined}
                  >
                    {cat.name}
                  </span>
                  <AnimatePresence>
                    {selected && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                        className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: cat.color }}
                      >
                        <CheckCircle2 size={9} className="text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visibility */}
      {showVisibility && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-widest mb-3">
            Visibility
          </p>
          <div className="space-y-2">
            {(["public", "internal"] as const).map((vis) => {
              const selected = visibility === vis;
              return (
                <label
                  key={vis}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selected
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                      : "border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-tertiary"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={vis}
                    checked={selected}
                    onChange={() => setVisibility(vis)}
                    className="sr-only"
                  />
                  <div className={`mt-0.5 flex-shrink-0 ${selected ? "text-brand-500" : "text-gray-400 dark:text-dark-tertiary"}`}>
                    {vis === "public" ? <Globe size={15} /> : <Lock size={15} />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold capitalize ${selected ? "text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-dark-secondary"}`}>
                      {vis}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mt-0.5 leading-relaxed">
                      {vis === "public" ? "Visible to everyone" : internalDescription}
                    </p>
                  </div>
                  {selected && <CheckCircle2 size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Publication status */}
      <div className={`flex items-start gap-2.5 rounded-xl p-3.5 text-[12px] ${
        autoApproved
          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
      }`}>
        <div className={`flex-shrink-0 mt-0.5 ${autoApproved ? "text-green-500" : "text-amber-500"}`}>
          {autoApproved ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
        </div>
        <div>
          <p className={`font-bold ${autoApproved ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            {autoApproved ? "Will be published immediately" : "Will go to review queue"}
          </p>
          <p className={`mt-0.5 leading-relaxed ${autoApproved ? "text-green-600 dark:text-green-500" : "text-amber-600 dark:text-amber-500"}`}>
            {autoApproved
              ? "Your post goes live right away."
              : "A moderator will approve it before it appears."}
          </p>
        </div>
      </div>
    </div>
  );
}
