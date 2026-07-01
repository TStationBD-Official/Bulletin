"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const REJECTION_REASONS = [
  "Inappropriate content",
  "Spam",
  "Misleading information",
  "Policy violation",
  "Low quality",
  "Duplicate",
  "Other",
];

interface RejectionModalProps {
  onConfirm: (reason: string, description: string) => Promise<void>;
  onCancel: () => void;
}

export default function RejectionModal({
  onConfirm,
  onCancel,
}: RejectionModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      await onConfirm(reason, description);
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
        onClick={onCancel}
      >
        <motion.div
          className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-dark-primary">Reject Post</h3>
            <button
              onClick={onCancel}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-dark-secondary mb-4">
            Provide a reason for rejection. The author will be notified.
          </p>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-secondary mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a reason…</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-secondary mb-2">
              Additional feedback (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Help the author improve their post…"
              className="w-full border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-dark-border text-sm text-gray-600 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason || loading}
              className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Rejecting…" : "Reject Post"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
