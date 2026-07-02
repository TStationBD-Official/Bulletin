"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { User, MoreVertical, Eye, ShieldOff, Ban, RotateCcw, Trash2, FileText } from "lucide-react";
import { UnifiedUser, suspendUser, banUser, reinstateUser, softDeleteUser } from "@/lib/firestore";
import { relativeTime, formatDate } from "@/lib/utils";
import { UserRole } from "@/types";
import { useStore } from "@/store/useStore";
import ConfirmModal from "./ConfirmModal";
import toast from "react-hot-toast";

interface Props {
  users: UnifiedUser[];
}

const ROLE_STYLES: Record<UserRole, { label: string; classes: string }> = {
  superAdmin: { label: "Super Admin",  classes: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" },
  admin:      { label: "Admin",        classes: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"         },
  student:    { label: "Student",      classes: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"     },
  guardian:   { label: "Guardian",     classes: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"     },
  feeds_user: { label: "Website User", classes: "bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-dark-secondary"   },
};

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  suspended: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
  banned:    "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  deleted:   "bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-dark-tertiary",
};

type PendingAction =
  | { type: "suspend"; user: UnifiedUser }
  | { type: "ban";     user: UnifiedUser }
  | { type: "reinstate" | "delete"; user: UnifiedUser };

export default function AllUsersTable({ users: initialUsers }: Props) {
  const { user: adminUser } = useStore();
  const [users, setUsers] = useState(initialUsers);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync if parent re-filters
  useEffect(() => { setUsers(initialUsers); }, [initialUsers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeModal = () => { setPendingAction(null); setReason(""); };

  const updateUserStatus = (id: string, status: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status } : u));
  };

  const handleConfirm = async () => {
    if (!adminUser || !pendingAction) return;
    const { type, user: target } = pendingAction;

    try {
      if (type === "suspend") {
        if (!reason.trim()) { toast.error("Please enter a reason"); return; }
        await suspendUser(target.id, adminUser.uid, reason.trim());
        updateUserStatus(target.id, "suspended");
        toast.success(`${target.name} suspended`);
      } else if (type === "ban") {
        if (!reason.trim()) { toast.error("Please enter a reason"); return; }
        await banUser(target.id, adminUser.uid, reason.trim());
        updateUserStatus(target.id, "banned");
        toast.success(`${target.name} banned`);
      } else if (type === "reinstate") {
        await reinstateUser(target.id, adminUser.uid);
        updateUserStatus(target.id, "active");
        toast.success(`${target.name} reinstated`);
      } else if (type === "delete") {
        await softDeleteUser(target.id, adminUser.uid);
        updateUserStatus(target.id, "deleted");
        toast.success(`${target.name} deleted`);
      }
      closeModal();
    } catch {
      toast.error("Action failed. Please try again.");
    }
  };

  return (
    <>
      <div className="overflow-x-auto" ref={menuRef}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-border/40">
              {["User", "Role", "Status", "Posts", "Joined", "Last active", "Actions"].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-semibold text-gray-600 dark:text-dark-secondary ${
                    i === 3 ? "text-center" : i === 6 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {users.map((u) => {
              const role = ROLE_STYLES[u.role];
              const status = u.status ?? "active";
              const isDeleted = status === "deleted";

              return (
                <tr
                  key={u.id}
                  className={`transition-colors ${isDeleted ? "opacity-50" : "hover:bg-gray-50 dark:hover:bg-dark-border/30"}`}
                >
                  {/* Avatar + name + email */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
                        {u.profileImageUrl ? (
                          <img src={u.profileImageUrl} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-900/30">
                            <User size={14} className="text-brand-500" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-primary leading-tight">{u.name}</p>
                        <p className="text-xs text-gray-400 dark:text-dark-tertiary truncate max-w-[180px]">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${role.classes}`}>
                      {role.label}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.active}`}>
                      {status}
                    </span>
                  </td>

                  {/* Posts */}
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${u.totalPosts > 0 ? "text-brand-600 dark:text-brand-400" : "text-gray-400 dark:text-dark-tertiary"}`}>
                      {u.totalPosts}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                      {u.createdAt ? formatDate(u.createdAt) : "—"}
                    </p>
                  </td>

                  {/* Last active */}
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-400 dark:text-dark-tertiary">
                      {u.lastLogin ? relativeTime(u.lastLogin) : "—"}
                    </p>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {u.role === "superAdmin" ? (
                      <span className="text-xs text-gray-400 dark:text-dark-muted">—</span>
                    ) : (
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 dark:text-dark-tertiary hover:text-gray-600 dark:hover:text-dark-secondary transition-colors"
                        >
                          <MoreVertical size={15} />
                        </button>

                        <AnimatePresence>
                          {openMenuId === u.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.92, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-xl z-20 py-1 overflow-hidden"
                            >
                              {/* View profile / posts */}
                              {u.role === "feeds_user" ? (
                                <Link
                                  href={`/admin/users/${u.id}`}
                                  onClick={() => setOpenMenuId(null)}
                                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
                                >
                                  <Eye size={14} className="text-gray-400" /> View Profile
                                </Link>
                              ) : (
                                <Link
                                  href={`/author/${u.id}`}
                                  onClick={() => setOpenMenuId(null)}
                                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
                                >
                                  <FileText size={14} className="text-gray-400" /> View Posts
                                </Link>
                              )}

                              {/* Moderation actions — feeds_user only */}
                              {u.role === "feeds_user" && !isDeleted && (
                                <>
                                  <div className="my-1 border-t border-gray-100 dark:border-dark-border" />

                                  {/* Suspend — only if active or banned */}
                                  {(status === "active") && (
                                    <button
                                      onClick={() => { setOpenMenuId(null); setPendingAction({ type: "suspend", user: u }); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                                    >
                                      <ShieldOff size={14} /> Suspend
                                    </button>
                                  )}

                                  {/* Ban — if active or suspended */}
                                  {(status === "active" || status === "suspended") && (
                                    <button
                                      onClick={() => { setOpenMenuId(null); setPendingAction({ type: "ban", user: u }); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                    >
                                      <Ban size={14} /> Ban
                                    </button>
                                  )}

                                  {/* Reinstate — if suspended or banned */}
                                  {(status === "suspended" || status === "banned") && (
                                    <button
                                      onClick={() => { setOpenMenuId(null); setPendingAction({ type: "reinstate", user: u }); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                    >
                                      <RotateCcw size={14} /> Reinstate
                                    </button>
                                  )}

                                  <div className="my-1 border-t border-gray-100 dark:border-dark-border" />

                                  {/* Delete */}
                                  <button
                                    onClick={() => { setOpenMenuId(null); setPendingAction({ type: "delete", user: u }); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Suspend modal — needs reason */}
      <AnimatePresence>
        {pendingAction?.type === "suspend" && (
          <ReasonModal
            title={`Suspend ${pendingAction.user.name}`}
            description="This user will be temporarily blocked from posting. Provide a reason:"
            actionLabel="Suspend User"
            actionColor="bg-yellow-500 hover:bg-yellow-600"
            reason={reason}
            onReasonChange={setReason}
            onConfirm={handleConfirm}
            onCancel={closeModal}
          />
        )}
      </AnimatePresence>

      {/* Ban modal — needs reason */}
      <AnimatePresence>
        {pendingAction?.type === "ban" && (
          <ReasonModal
            title={`Ban ${pendingAction.user.name}`}
            description="This will permanently ban the user and hide all their posts. Provide a reason:"
            actionLabel="Ban User"
            actionColor="bg-orange-500 hover:bg-orange-600"
            reason={reason}
            onReasonChange={setReason}
            onConfirm={handleConfirm}
            onCancel={closeModal}
          />
        )}
      </AnimatePresence>

      {/* Reinstate confirm */}
      {pendingAction?.type === "reinstate" && (
        <ConfirmModal
          title={`Reinstate ${pendingAction.user.name}`}
          description="Their account will be restored to active status."
          action="Reinstate"
          isDangerous={false}
          onConfirm={handleConfirm}
          onCancel={closeModal}
        />
      )}

      {/* Delete confirm */}
      {pendingAction?.type === "delete" && (
        <ConfirmModal
          title={`Delete ${pendingAction.user.name}`}
          description="Their account will be marked as deleted. This hides their data but does not remove it from the database."
          action="Delete User"
          isDangerous
          requiresText="delete"
          onConfirm={handleConfirm}
          onCancel={closeModal}
        />
      )}
    </>
  );
}

/* ─── Reason Modal ─────────────────────────────────────────────────────────── */

interface ReasonModalProps {
  title: string;
  description: string;
  actionLabel: string;
  actionColor: string;
  reason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function ReasonModal({ title, description, actionLabel, actionColor, reason, onReasonChange, onConfirm, onCancel }: ReasonModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 dark:text-dark-primary mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-dark-tertiary mb-4">{description}</p>

        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Enter reason…"
          rows={3}
          className="w-full border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-dark-primary dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none mb-4"
        />

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-sm text-gray-600 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || loading}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${actionColor}`}
          >
            {loading ? "Processing…" : actionLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
