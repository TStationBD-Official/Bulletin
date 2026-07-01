"use client";

import Link from "next/link";
import { Post } from "@/types";
import { relativeTime, truncate } from "@/lib/utils";

interface PostTableProps {
  posts: Post[];
  onAction?: (postId: string, action: string) => void;
}

export default function PostTable({ posts, onAction }: PostTableProps) {
  const statusColors: Record<string, string> = {
    approved: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    pending: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
    rejected: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
    deleted: "bg-gray-50 dark:bg-dark-border text-gray-700 dark:text-dark-secondary",
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-dark-tertiary text-sm">No posts found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-border/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-secondary">
              Author
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-secondary">
              Content
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-secondary">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-dark-secondary">
              Engagement
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-secondary">
              Created
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-dark-secondary">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
          {posts.map((post) => (
            <tr
              key={post.id}
              className="hover:bg-gray-50 dark:hover:bg-dark-border/50 transition-colors"
            >
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-primary">
                  {post.authorName}
                </p>
              </td>
              <td className="px-4 py-3">
                <Link href={`/post/${post.id}`}>
                  <p className="text-sm text-gray-600 dark:text-dark-secondary hover:text-brand-500 cursor-pointer max-w-xs truncate">
                    {truncate(post.content || "", 50)}
                  </p>
                </Link>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${
                    statusColors[post.status]
                  }`}
                >
                  {post.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <p className="text-sm font-medium text-gray-600 dark:text-dark-secondary">
                  {(
                    post.likes +
                    post.comments +
                    post.shares
                  ).toLocaleString()}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                  {relativeTime(post.createdAt)}
                </p>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/post/${post.id}`}
                  className="text-xs text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 font-medium"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
