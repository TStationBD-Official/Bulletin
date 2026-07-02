"use client";

import Link from "next/link";
import { FeedsUser } from "@/types";
import { relativeTime, formatDate } from "@/lib/utils";

interface UserTableProps {
  users: FeedsUser[];
}

export default function UserTable({ users }: UserTableProps) {
  const statusColors: Record<string, string> = {
    active: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    suspended: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
    banned: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
    deleted: "bg-gray-50 dark:bg-dark-border text-gray-700 dark:text-dark-secondary",
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-border/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-dark-secondary">
              User
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              Status
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
              Posts
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              Joined
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              Last Login
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-dark-border/50 transition-colors">
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-primary">{user.name}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm text-gray-600 dark:text-dark-secondary">{user.email}</p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${
                    statusColors[user.status ?? "active"]
                  }`}
                >
                  {user.status ?? "active"}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <p className="text-sm font-medium text-gray-600">—</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                  {formatDate(user.createdAt)}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                  {relativeTime(user.lastLogin)}
                </p>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/users/${user.id}`}
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
