"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

export default function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col items-center justify-center py-16 text-center", className)}
    >
      <motion.span
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="text-5xl mb-4"
      >
        {icon}
      </motion.span>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-dark-secondary max-w-sm mb-5">{description}</p>
      )}
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            {action.label}
          </button>
        ))}
    </motion.div>
  );
}
