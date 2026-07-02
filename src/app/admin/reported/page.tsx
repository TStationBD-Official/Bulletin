"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Flag, User, Eye, Trash2, AlertTriangle, X } from "lucide-react";
import {
  getAllReports,
  resolveReport,
  dismissReport,
  updateReportStatus,
  resolveAuthor,
  deleteReportedPost,
  warnPostAuthor,
} from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { Report, ReportStatus, AuthorProfile, Post } from "@/types";
import { relativeTime } from "@/lib/utils";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface EnrichedReport extends Report {
  postPreview?: {
    title: string;
    contentSnippet: string;
    authorName: string;
    authorId: string;
    categoryName?: string;
    categoryColor?: string;
    categoryIcon?: string;
  } | null;
  reporterProfile?: AuthorProfile | null;
}

type ActionModal =
  | { type: "delete"; report: EnrichedReport }
  | { type: "warn";   report: EnrichedReport }
  | null;

const REASON_COLORS: Record<string, string> = {
  spam:                    "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700/40",
  harassment:              "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/40",
  "inappropriate content": "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700/40",
  "misleading information":"bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700/40",
  "hate speech":           "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700/40",
  other:                   "bg-gray-100 dark:bg-dark-border text-gray-700 dark:text-dark-secondary border-gray-200 dark:border-dark-border",
};
const STATUS_STYLES: Record<string, string> = {
  open:      "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  reviewing: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  resolved:  "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  dismissed: "bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-dark-tertiary",
};

export default function ReportedContentPage() {
  const { user } = useStore();
  const [reports, setReports] = useState<EnrichedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [actionText, setActionText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getAllReports();
        const enriched: EnrichedReport[] = await Promise.all(
          raw.map(async (r) => {
            const [postSnap, reporterProfile] = await Promise.all([
              r.postId ? getDoc(doc(db, "posts", r.postId)) : Promise.resolve(null),
              resolveAuthor(r.reportedBy),
            ]);

            let postPreview: EnrichedReport["postPreview"] = null;
            if (postSnap?.exists()) {
              const d = postSnap.data() as any;
              let snippet = (d.content ?? d.body ?? d.text ?? "")
                .replace(/<[^>]*>/g, "").trim();
              if (!snippet && d.richContent) {
                try {
                  const delta = JSON.parse(d.richContent);
                  snippet = (delta.ops ?? [])
                    .map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
                    .join("").trim();
                } catch {}
              }
              postPreview = {
                title: d.title ?? r.postTitle ?? "",
                contentSnippet: snippet.slice(0, 130),
                authorName: d.authorName ?? "",
                authorId: d.authorId ?? "",
                categoryName: d.categoryName,
                categoryColor: d.categoryColor,
                categoryIcon: d.categoryIcon,
              };
            } else if (r.postTitle) {
              postPreview = { title: r.postTitle, contentSnippet: "", authorName: "", authorId: "" };
            }

            return { ...r, postPreview, reporterProfile };
          })
        );
        setReports(enriched);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openAction = (type: "delete" | "warn", report: EnrichedReport) => {
    setActionText(
      type === "warn"
        ? `Your post "${report.postPreview?.title || report.postPreview?.contentSnippet || "untitled"}" has been reported by a community member. Please review your content and make necessary edits to comply with our community guidelines.`
        : ""
    );
    setActionModal({ type, report });
  };

  const handleDelete = async () => {
    if (!user || !actionModal || actionModal.type !== "delete") return;
    const { report } = actionModal;
    if (!report.postId || !report.postPreview?.authorId) {
      toast.error("Missing post or author info");
      return;
    }
    if (!actionText.trim()) { toast.error("Please provide a reason"); return; }
    setActionLoading(true);
    try {
      await deleteReportedPost(
        report.postId,
        report.postPreview.authorId,
        user.uid,
        report.id,
        actionText.trim()
      );
      setReports((r) => r.filter((x) => x.id !== report.id));
      toast.success("Post deleted and author notified");
      setActionModal(null);
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWarn = async () => {
    if (!user || !actionModal || actionModal.type !== "warn") return;
    const { report } = actionModal;
    if (!report.postId || !report.postPreview?.authorId) {
      toast.error("Missing post or author info");
      return;
    }
    if (!actionText.trim()) { toast.error("Please write a warning message"); return; }
    setActionLoading(true);
    try {
      await warnPostAuthor(
        report.postId,
        report.postPreview.authorId,
        user.uid,
        report.id,
        actionText.trim()
      );
      setReports((r) =>
        r.map((x) => (x.id === report.id ? { ...x, status: "reviewing" as ReportStatus } : x))
      );
      toast.success("Warning sent to author");
      setActionModal(null);
    } catch {
      toast.error("Failed to send warning");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (reportId: string, newStatus: "open" | "reviewing") => {
    try {
      await updateReportStatus(reportId, newStatus);
      setReports((r) => r.map((x) => (x.id === reportId ? { ...x, status: newStatus } : x)));
      toast.success("Status updated");
    } catch { toast.error("Failed to update status"); }
  };

  const handleResolve = async (reportId: string) => {
    if (!user) return;
    try {
      await resolveReport(reportId, "Content action taken", user.uid);
      setReports((r) => r.filter((x) => x.id !== reportId));
      toast.success("Report resolved");
    } catch { toast.error("Failed to resolve"); }
  };

  const handleDismiss = async (reportId: string) => {
    if (!user) return;
    try {
      await dismissReport(reportId, user.uid);
      setReports((r) => r.filter((x) => x.id !== reportId));
      toast.success("Report dismissed");
    } catch { toast.error("Failed to dismiss"); }
  };

  const filtered = statusFilter ? reports.filter((r) => r.status === statusFilter) : reports;
  const openCount = reports.filter((r) => r.status === "open").length;

  if (loading) return <PageLoader />;

  return (
    <main className="p-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="relative">
            <Flag size={28} className="text-red-500" />
            {openCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {openCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-primary">Reported Content</h1>
            <p className="text-gray-500 dark:text-dark-tertiary mt-0.5 text-sm">
              {reports.length} total · {openCount} open
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["", "open", "reviewing", "resolved", "dismissed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : `All (${reports.length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="✅" title="All caught up!" description="No reports to review." className="py-16" />
        ) : (
          <div className="space-y-5">
            {filtered.map((report, i) => {
              const reasonKey = report.reason.toLowerCase();
              const reasonStyle = REASON_COLORS[reasonKey] ?? REASON_COLORS.other;
              const hasPost = !!report.postId && !!report.postPreview?.authorId;

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-card overflow-hidden"
                >
                  {/* Top bar */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-dark-bg/60 border-b border-gray-100 dark:border-dark-border">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${reasonStyle}`}>
                      <Flag size={11} /> {report.reason}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 dark:text-dark-tertiary">{relativeTime(report.createdAt)}</span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[report.status] ?? STATUS_STYLES.open}`}>
                        {report.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 grid md:grid-cols-2 gap-6">
                    {/* Reporter */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-wider">Reported by</p>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 dark:bg-dark-border flex-shrink-0 ring-2 ring-white dark:ring-dark-card shadow-sm">
                          {report.reporterProfile?.profileImageUrl ? (
                            <img src={report.reporterProfile.profileImageUrl} alt={report.reporterProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                              <User size={18} className="text-brand-500" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-dark-primary">
                            {report.reporterProfile?.name ?? report.reporterName ?? "Unknown"}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                            {report.reporterProfile?.email ?? report.reportedBy}
                          </p>
                        </div>
                      </div>
                      {report.description && (
                        <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3.5 border-l-2 border-red-300 dark:border-red-600">
                          <p className="text-xs text-gray-600 dark:text-dark-secondary leading-relaxed italic">"{report.description}"</p>
                        </div>
                      )}
                    </div>

                    {/* Post */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold text-gray-400 dark:text-dark-tertiary uppercase tracking-wider">Reported post</p>
                      {report.postPreview ? (
                        <div className="rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg overflow-hidden">
                          {report.postPreview.categoryName && (
                            <div className="px-3.5 py-1.5 flex items-center gap-1.5" style={{ backgroundColor: (report.postPreview.categoryColor ?? "#6366f1") + "18" }}>
                              <span className="text-xs">{report.postPreview.categoryIcon ?? "📌"}</span>
                              <span className="text-xs font-semibold" style={{ color: report.postPreview.categoryColor ?? "#6366f1" }}>
                                {report.postPreview.categoryName}
                              </span>
                            </div>
                          )}
                          <div className="p-3.5">
                            <p className="text-sm font-bold text-gray-900 dark:text-dark-primary leading-snug mb-1.5 line-clamp-2">
                              {report.postPreview.title || report.postPreview.contentSnippet || "(no content)"}
                            </p>
                            {report.postPreview.title && report.postPreview.contentSnippet && (
                              <p className="text-xs text-gray-500 dark:text-dark-tertiary leading-relaxed line-clamp-2 mb-2">
                                {report.postPreview.contentSnippet}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              {report.postPreview.authorName && (
                                <span className="text-xs text-gray-400 dark:text-dark-tertiary">by <span className="font-medium text-gray-600 dark:text-dark-secondary">{report.postPreview.authorName}</span></span>
                              )}
                              {report.postId && (
                                <Link href={`/post/${report.postId}`} target="_blank" className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium ml-auto">
                                  <Eye size={11} /> View
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg p-4 text-center">
                          <p className="text-xs text-gray-400 dark:text-dark-tertiary italic">
                            {report.postId ? "Post has been deleted" : "No post attached"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 px-5 pb-5 pt-1 border-t border-gray-100 dark:border-dark-border">
                    {/* Primary moderation actions */}
                    {hasPost && report.status !== "resolved" && (
                      <>
                        <button
                          onClick={() => openAction("warn", report)}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        >
                          <AlertTriangle size={12} /> Warn Author
                        </button>
                        <button
                          onClick={() => openAction("delete", report)}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={12} /> Delete Post
                        </button>
                      </>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      {report.status !== "reviewing" && (
                        <button onClick={() => handleStatusUpdate(report.id, "reviewing")} className="px-3.5 py-1.5 text-xs border border-yellow-200 dark:border-yellow-700/40 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors font-medium">
                          Mark Reviewing
                        </button>
                      )}
                      {report.status !== "resolved" && (
                        <button onClick={() => handleResolve(report.id)} className="px-3.5 py-1.5 text-xs border border-green-200 dark:border-green-700/40 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors font-medium">
                          Resolve
                        </button>
                      )}
                      {report.status !== "dismissed" && (
                        <button onClick={() => handleDismiss(report.id)} className="px-3.5 py-1.5 text-xs border border-gray-200 dark:border-dark-border text-gray-500 dark:text-dark-tertiary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors font-medium">
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action modal */}
      <AnimatePresence>
        {actionModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActionModal(null)}
          >
            <motion.div
              className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-border rounded-t-2xl ${
                actionModal.type === "delete"
                  ? "bg-red-50 dark:bg-red-900/20"
                  : "bg-amber-50 dark:bg-amber-900/20"
              }`}>
                <div className="flex items-center gap-2">
                  {actionModal.type === "delete" ? (
                    <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                  )}
                  <h3 className={`font-semibold text-sm ${actionModal.type === "delete" ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
                    {actionModal.type === "delete" ? "Delete Post & Notify Author" : "Warn Author"}
                  </h3>
                </div>
                <button onClick={() => setActionModal(null)} className="p-1 rounded-full hover:bg-black/10 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Post summary */}
                <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 text-xs text-gray-600 dark:text-dark-secondary">
                  <span className="font-semibold">Post:</span>{" "}
                  {actionModal.report.postPreview?.title || actionModal.report.postPreview?.contentSnippet || "Untitled"}
                  {actionModal.report.postPreview?.authorName && (
                    <span className="text-gray-400"> · by {actionModal.report.postPreview.authorName}</span>
                  )}
                </div>

                {/* Message/reason field */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-dark-secondary mb-1.5">
                    {actionModal.type === "delete"
                      ? "Reason for removal (sent to author) *"
                      : "Warning message to author *"}
                  </label>
                  <textarea
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    rows={4}
                    placeholder={
                      actionModal.type === "delete"
                        ? "e.g. Your post violated our community guidelines regarding spam content."
                        : "e.g. Your post has been flagged by community members. Please review and edit it…"
                    }
                    className="w-full border border-gray-200 dark:border-dark-border rounded-xl px-3.5 py-2.5 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                {actionModal.type === "delete" && (
                  <p className="text-xs text-red-500 dark:text-red-400 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    This will permanently remove the post from the feed and notify the author.
                  </p>
                )}
                {actionModal.type === "warn" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    The post will remain visible. The author will receive a notification with your message.
                  </p>
                )}
              </div>

              {/* Modal actions */}
              <div className="flex gap-2 px-5 pb-5">
                <button
                  onClick={() => setActionModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-sm text-gray-600 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={actionModal.type === "delete" ? handleDelete : handleWarn}
                  disabled={!actionText.trim() || actionLoading}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    actionModal.type === "delete"
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  {actionLoading
                    ? "Sending…"
                    : actionModal.type === "delete"
                    ? "Delete & Notify"
                    : "Send Warning"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
