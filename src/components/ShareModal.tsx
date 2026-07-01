"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Share2 } from "lucide-react";
import toast from "react-hot-toast";

interface ShareModalProps {
  postId: string;
  title?: string;
  onClose: () => void;
}

export default function ShareModal({ postId, title, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/post/${postId}`
    : `/post/${postId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: title ?? "Check this out", url });
    } else {
      handleCopy();
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
            <h3 className="font-semibold text-gray-900 dark:text-dark-primary">Share Post</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              value={url}
              readOnly
              className="flex-1 text-xs border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2 bg-gray-50 dark:bg-dark-card text-gray-600 dark:text-dark-secondary focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>

          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 py--2.5 rounded-lg border border-gray-200 dark:border-dark-border text-sm text-gray-700 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
            >
              <Share2 size={16} />
              Share via…
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
