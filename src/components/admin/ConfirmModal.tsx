"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  description: string;
  action: string;
  isDangerous?: boolean;
  requiresText?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  description,
  action,
  isDangerous = false,
  requiresText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = !requiresText || confirmText === requiresText;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
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
            <div className="flex items-center gap-3">
              {isDangerous && (
                <AlertTriangle size={20} className="text-red-500" />
              )}
              <h3 className="font-semibold text-gray-900 dark:text-dark-primary">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-dark-secondary mb-5">{description}</p>

          {requiresText && (
            <div className="mb-5">
              <p className="text-xs font-medium text-gray-700 dark:text-dark-secondary mb-2">
                Type "{requiresText}" to confirm:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={requiresText}
                className="w-full border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-dark-border text-sm text-gray-600 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || loading}
              className={`flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDangerous
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-brand-500 hover:bg-brand-600"
              }`}
            >
              {loading ? "Processing…" : action}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
