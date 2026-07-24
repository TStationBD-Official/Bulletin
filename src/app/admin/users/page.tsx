"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Search } from "lucide-react";
import { getAllUsersWithStats } from "@/lib/firestore";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import AllUsersTable from "@/components/admin/AllUsersTable";

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "superAdmin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "student", label: "Student" },
  { value: "guardian", label: "Guardian" },
  { value: "feeds_user", label: "Website User" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
  { value: "deleted", label: "Deleted" },
];

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Cached — this reads every user + every post, so re-fetching on every
  // navigation into this page (previously a plain useEffect) was re-paying
  // that full cost each visit. 2 min staleTime keeps it snappy for an admin
  // clicking around without going stale for the whole session.
  const { data: users = [], isLoading: loading } = useQuery({
    queryKey: ["admin", "allUsersWithStats"],
    queryFn: getAllUsersWithStats,
    staleTime: 2 * 60 * 1000,
  });

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = !statusFilter || (u.status ?? "active") === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) return <PageLoader />;

  return (
    <main className="p-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8 flex items-center gap-3">
          <Users size={28} className="text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-primary">Users</h1>
            <p className="text-gray-500 dark:text-dark-tertiary mt-0.5 text-sm">
              {users.length} total across all roles
            </p>
          </div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border p-4 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary placeholder:text-gray-400 dark:placeholder:text-dark-muted"
              />
            </div>

            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {filtered.length !== users.length && (
            <p className="text-xs text-gray-400 dark:text-dark-tertiary mt-3">
              Showing {filtered.length} of {users.length} users
            </p>
          )}
        </motion.div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="👤"
            title="No users found"
            description="Try adjusting the filters"
            className="py-16"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden"
          >
            <AllUsersTable users={filtered} />
          </motion.div>
        )}
      </div>
    </main>
  );
}
