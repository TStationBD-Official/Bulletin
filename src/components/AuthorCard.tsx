"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { User } from "lucide-react";
import { AuthorProfile } from "@/types";

interface AuthorCardProps {
  author: AuthorProfile;
  totalPosts?: number;
  totalEngagement?: number;
  variant?: "compact" | "full";
}

export default function AuthorCard({
  author,
  totalPosts,
  totalEngagement,
  variant = "compact",
}: AuthorCardProps) {
  return (
    <Link href={`/author/${author.id}`}>
      <div
        className={`flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-border transition-colors cursor-pointer ${
          variant === "full" ? "flex-col text-center" : ""
        }`}
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.2 }}
          className={`relative flex-shrink-0 rounded-full overflow-hidden bg-gray-200 ${
            variant === "full" ? "w-20 h-20" : "w-10 h-10"
          }`}
        >
          {author.profileImageUrl ? (
            <img
              src={author.profileImageUrl}
              alt={author.name}
              className="w-full h-full object-cover" referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-100">
              <User
                size={variant === "full" ? 32 : 20}
                className="text-brand-500"
              />
            </div>
          )}
        </motion.div>

        <div className={variant === "full" ? "text-center" : "flex-1 min-w-0"}>
          <p className="font-medium text-gray-900 dark:text-dark-primary text-sm truncate">
            {author.name}
          </p>
          <div className="flex gap-3 mt-0.5">
            {totalPosts !== undefined && (
              <span className="text-xs text-gray-400 dark:text-dark-tertiary">{totalPosts} posts</span>
            )}
            {totalEngagement !== undefined && (
              <span className="text-xs text-gray-400 dark:text-dark-tertiary">
                {totalEngagement.toLocaleString()} engagement
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
