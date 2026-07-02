"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ScrollText, Download, Search, CheckCircle2, XCircle, EyeOff,
  Trash2, AlertTriangle, UserX, ShieldOff, UserCheck, UserMinus,
  FileEdit, User, Clock, Filter,
} from "lucide-react";
import { getAdminLogs, resolveAuthor } from "@/lib/firestore";
import { AdminLog, AuthorProfile } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { relativeTime, isRecentEntry, formatDateTime } from "@/lib/utils";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";

// ── Action meta ────────────────────────────────────────────────────────────────
const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string; dot: string }> = {
  approve_post:          { label: "Approved post",        icon: CheckCircle2,  color: "text-green-600 dark:text-green-400",  dot: "bg-green-500" },
  reject_post:           { label: "Rejected post",        icon: XCircle,       color: "text-red-600 dark:text-red-400",      dot: "bg-red-500"   },
  hide_post:             { label: "Hidden post",          icon: EyeOff,        color: "text-gray-500 dark:text-gray-400",    dot: "bg-gray-400"  },
  unhide_post:           { label: "Unhidden post",        icon: CheckCircle2,  color: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-400"  },
  soft_delete_post:      { label: "Deleted post",         icon: Trash2,        color: "text-orange-600 dark:text-orange-400",dot: "bg-orange-500"},
  hard_delete_post:      { label: "Permanently deleted",  icon: Trash2,        color: "text-red-700 dark:text-red-400",      dot: "bg-red-600"   },
  delete_reported_post:  { label: "Removed reported post",icon: Trash2,        color: "text-red-600 dark:text-red-400",      dot: "bg-red-500"   },
  warn_post_author:      { label: "Warned author",        icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-500" },
  suspend_user:          { label: "Suspended user",       icon: UserX,         color: "text-yellow-600 dark:text-yellow-400",dot: "bg-yellow-500"},
  ban_user:              { label: "Banned user",          icon: ShieldOff,     color: "text-red-600 dark:text-red-400",      dot: "bg-red-500"   },
  reinstate_user:        { label: "Reinstated user",      icon: UserCheck,     color: "text-green-600 dark:text-green-400",  dot: "bg-green-500" },
  delete_user:           { label: "Deleted user",         icon: UserMinus,     color: "text-red-700 dark:text-red-400",      dot: "bg-red-600"   },
  edit_post:             { label: "Edited post",          icon: FileEdit,      color: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-500"  },
};

const DEFAULT_META = { label: "", icon: Clock, color: "text-gray-500 dark:text-gray-400", dot: "bg-gray-400" };

const ACTION_GROUPS = [
  { label: "Post actions",  values: ["approve_post","reject_post","hide_post","unhide_post","soft_delete_post","hard_delete_post","delete_reported_post","warn_post_author","edit_post"] },
  { label: "User actions",  values: ["suspend_user","ban_user","reinstate_user","delete_user"] },
];

// ── Date grouping ──────────────────────────────────────────────────────────────
function dayLabel(ts: any): string {
  const d = ts?.toDate?.() ?? new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const d0 = new Date(d); d0.setHours(0,0,0,0);
  if (d0.getTime() === today.getTime()) return "Today";
  if (d0.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [adminCache, setAdminCache] = useState<Record<string, AuthorProfile | null>>({});
  const [targetCache, setTargetCache] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const allLogs = await getAdminLogs(500);
        setLogs(allLogs);

        // Resolve admin names
        const adminIds = Array.from(new Set(allLogs.map((l) => l.adminId)));
        const adminC: Record<string, AuthorProfile | null> = {};
        await Promise.all(adminIds.map(async (id) => { adminC[id] = await resolveAuthor(id); }));
        setAdminCache(adminC);

        // Resolve target labels (post title or user name)
        const targetC: Record<string, string> = {};
        await Promise.all(
          allLogs.map(async (l) => {
            if (targetC[l.targetId]) return; // already resolved
            try {
              if (l.targetType === "post") {
                const snap = await getDoc(doc(db, "posts", l.targetId));
                if (snap.exists()) {
                  const d = snap.data() as any;
                  targetC[l.targetId] = d.title || (d.content ?? "").slice(0, 60) || "Untitled post";
                } else {
                  targetC[l.targetId] = "Deleted post";
                }
              } else if (l.targetType === "user") {
                const profile = await resolveAuthor(l.targetId);
                targetC[l.targetId] = profile?.name ?? "Unknown user";
              }
            } catch {
              targetC[l.targetId] = l.targetId;
            }
          })
        );
        setTargetCache(targetC);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      const matchesSearch = !q ||
        l.action.replace(/_/g, " ").includes(q) ||
        l.targetId.toLowerCase().includes(q) ||
        (l.reason ?? "").toLowerCase().includes(q) ||
        (adminCache[l.adminId]?.name ?? "").toLowerCase().includes(q);
      const matchesAction = !actionFilter || l.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter, adminCache]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, AdminLog[]>();
    filtered.forEach((l) => {
      const label = dayLabel(l.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(l);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Stats
  const todayCount  = logs.filter((l) => dayLabel(l.createdAt) === "Today").length;
  const weekCount   = logs.filter((l) => {
    const d = l.createdAt?.toDate?.() ?? new Date();
    return Date.now() - d.getTime() < 7 * 86400000;
  }).length;

  const handleExportCSV = () => {
    const csv = [
      ["Timestamp","Admin","Action","Target ID","Target Type","Reason"],
      ...filtered.map((l) => [
        formatDateTime(l.createdAt),
        adminCache[l.adminId]?.name ?? l.adminId,
        l.action.replace(/_/g, " "),
        targetCache[l.targetId] ?? l.targetId,
        l.targetType,
        l.reason ?? "",
      ]),
    ].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `admin-logs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  return (
    <main className="p-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ScrollText size={28} className="text-indigo-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-primary">Activity Logs</h1>
              <p className="text-gray-500 dark:text-dark-tertiary mt-0.5 text-sm">
                Complete audit trail of all moderation actions
              </p>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-secondary text-sm font-medium hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total logs",    value: logs.length,  color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Today",         value: todayCount,   color: "text-blue-600 dark:text-blue-400" },
            { label: "This week",     value: weekCount,    color: "text-purple-600 dark:text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-dark-border p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 dark:text-dark-tertiary mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-dark-border p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by action, admin name, target ID, or reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-700 dark:text-dark-primary placeholder:text-gray-400"
            />
          </div>

          {/* Action filter chips */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-dark-tertiary uppercase tracking-wide mb-2 flex items-center gap-1">
              <Filter size={11} /> Filter by action
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActionFilter("")}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${!actionFilter ? "bg-brand-500 text-white" : "bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-dark-secondary hover:bg-gray-200 dark:hover:bg-dark-bg"}`}
              >
                All ({logs.length})
              </button>
              {ACTION_GROUPS.map((grp) => (
                grp.values
                  .filter((v) => logs.some((l) => l.action === v))
                  .map((v) => {
                    const meta = ACTION_META[v] ?? DEFAULT_META;
                    const count = logs.filter((l) => l.action === v).length;
                    return (
                      <button
                        key={v}
                        onClick={() => setActionFilter(actionFilter === v ? "" : v)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full font-medium transition-colors capitalize ${actionFilter === v ? "bg-brand-500 text-white" : "bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-dark-secondary hover:bg-gray-200 dark:hover:bg-dark-bg"}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label || v.replace(/_/g, " ")}
                        <span className="opacity-60">({count})</span>
                      </button>
                    );
                  })
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        {grouped.length === 0 ? (
          <EmptyState icon="📋" title="No logs found" description="Try adjusting your filters." className="py-16" />
        ) : (
          <div className="space-y-8">
            {grouped.map(([day, dayLogs]) => (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-gray-500 dark:text-dark-tertiary uppercase tracking-wider whitespace-nowrap">
                    {day}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border" />
                  <span className="text-[11px] text-gray-400 dark:text-dark-tertiary whitespace-nowrap">
                    {dayLogs.length} action{dayLogs.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Log entries */}
                <div className="relative">
                  {/* Vertical connector line */}
                  <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gray-200 dark:bg-dark-border" />

                  <div className="space-y-3">
                    {dayLogs.map((log, i) => {
                      const meta = ACTION_META[log.action] ?? { ...DEFAULT_META, label: log.action.replace(/_/g, " ") };
                      const Icon = meta.icon;
                      const isRecent = isRecentEntry(log.createdAt);
                      const admin = adminCache[log.adminId];

                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.3) }}
                          className="relative flex gap-4"
                        >
                          {/* Dot */}
                          <div className="relative z-10 flex-shrink-0">
                            {isRecent ? (
                              <motion.div
                                animate={{ opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${meta.dot} bg-opacity-20`}
                                style={{ backgroundColor: undefined }}
                              >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-dark-card border-2 ${
                                  meta.dot === "bg-green-500" ? "border-green-400" :
                                  meta.dot === "bg-red-500"   ? "border-red-400" :
                                  meta.dot === "bg-amber-500" ? "border-amber-400" :
                                  meta.dot === "bg-orange-500"? "border-orange-400" :
                                  meta.dot === "bg-yellow-500"? "border-yellow-400" :
                                  meta.dot === "bg-blue-500"  ? "border-blue-400" :
                                  "border-gray-300 dark:border-dark-border"
                                }`}>
                                  <Icon size={16} className={meta.color} />
                                </div>
                              </motion.div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border flex items-center justify-center">
                                <Icon size={16} className={meta.color} />
                              </div>
                            )}
                          </div>

                          {/* Card */}
                          <div className={`flex-1 bg-white dark:bg-dark-card rounded-xl border p-4 hover:shadow-sm transition-shadow ${
                            isRecent
                              ? "border-blue-200 dark:border-blue-700/40 bg-blue-50/30 dark:bg-blue-900/10"
                              : "border-gray-100 dark:border-dark-border"
                          }`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                {/* Action label */}
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-dark-primary capitalize">
                                    {meta.label}
                                  </span>
                                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                                    log.targetType === "post" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" :
                                    log.targetType === "user" ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" :
                                    "bg-gray-100 dark:bg-dark-border text-gray-500"
                                  }`}>
                                    {log.targetType}
                                  </span>
                                  {isRecent && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 animate-pulse">
                                      NEW
                                    </span>
                                  )}
                                </div>

                                {/* Admin info */}
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
                                    {admin?.profileImageUrl ? (
                                      <img src={admin.profileImageUrl} alt={admin.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <User size={10} className="text-gray-400 dark:text-dark-tertiary" />
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-dark-tertiary">
                                    by <span className="font-medium text-gray-700 dark:text-dark-secondary">{admin?.name ?? log.adminId}</span>
                                  </span>
                                </div>

                                {/* Target */}
                                <p className="text-xs text-gray-600 dark:text-dark-secondary truncate max-w-xs">
                                  {log.targetType === "post" ? "📄" : "👤"}{" "}
                                  <span className="font-medium">
                                    {targetCache[log.targetId] ?? log.targetId}
                                  </span>
                                </p>

                                {/* Reason */}
                                {log.reason && (
                                  <p className="text-xs text-gray-600 dark:text-dark-secondary mt-1.5 bg-gray-50 dark:bg-dark-bg rounded-lg px-2.5 py-1.5 border-l-2 border-gray-300 dark:border-dark-border">
                                    "{log.reason}"
                                  </p>
                                )}
                              </div>

                              {/* Timestamp */}
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-medium text-gray-500 dark:text-dark-tertiary">
                                  {formatDateTime(log.createdAt)}
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mt-0.5">
                                  {relativeTime(log.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
