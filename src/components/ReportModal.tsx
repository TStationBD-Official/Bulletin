"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flag } from "lucide-react";
import { reportContent } from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import toast from "react-hot-toast";

const REASONS = [
  "Spam",
  "Harassment",
  "Inappropriate content",
  "Misleading information",
  "Hate speech",
  "Other",
];

interface ReportModalProps {
  postId?: string;
  postTitle?: string;
  commentId?: string;
  userId?: string;
  onClose: () => void;
}

export default function ReportModal({
  postId,
  postTitle,
  commentId,
  userId,
  onClose,
}: ReportModalProps) {
  const { user, userData } = useStore();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setLoading(true);
    try {
      const reporterName = (userData as any)?.name ?? user.displayName ?? "Anonymous";
      await reportContent({
        postId,
        commentId,
        userId,
        reportedBy: user.uid,
        reporterName,
        reason,
        description,
        postTitle,
      });
      toast.success("Report submitted. Thank you for keeping the community safe.");
      onClose();
    } catch {
      toast.error("Failed to submit report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flag size={18} className="text-red-500" />
              <h3 className="font-semibold text-gray-900 dark:text-dark-primary">Report Content</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-secondary mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a reason…</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-secondary mb-1">
              Additional details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide more context (optional)"
              className="w-full border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-dark-border text-sm text-gray-600 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason || loading}
              className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
