"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Clock, FileText, Users,
  Flag, Settings, ScrollText, Tag, X,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";

const NAV_ITEMS = [
  { href: "/admin",            label: "Dashboard",        icon: LayoutDashboard, exact: true },
  { href: "/admin/pending",    label: "Pending Posts",    icon: Clock,           badge: true },
  { href: "/admin/posts",      label: "All Posts",        icon: FileText },
  { href: "/admin/users",      label: "Users",            icon: Users },
  { href: "/admin/reported",   label: "Reported Content", icon: Flag },
  { href: "/admin/categories", label: "Categories",       icon: Tag },
  { href: "/admin/settings",   label: "Settings",         icon: Settings },
  { href: "/admin/logs",       label: "Activity Logs",    icon: ScrollText },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

function NavList({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { pendingPostsCount } = useStore();

  return (
    <nav className="p-3 space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link key={item.href} href={item.href} onClick={onItemClick}>
            <div
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-admin-50 dark:bg-admin-900/20 text-admin-600 dark:text-admin-400"
                  : "text-gray-600 dark:text-dark-secondary hover:bg-gray-50 dark:hover:bg-dark-border hover:text-gray-900 dark:hover:text-dark-primary"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={17} />
                {item.label}
              </div>
              {item.badge && pendingPostsCount > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                  className="min-w-[20px] h-5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5"
                >
                  {pendingPostsCount > 99 ? "99+" : pendingPostsCount}
                </motion.span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────── */}
      <aside className="hidden md:block w-60 flex-shrink-0 bg-white dark:bg-dark-card border-r border-gray-100 dark:border-dark-border min-h-[calc(100vh-64px)]">
        <NavList />
      </aside>

      {/* ── Mobile drawer ─────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-white dark:bg-dark-card border-r border-gray-100 dark:border-dark-border shadow-2xl md:hidden flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-dark-border flex-shrink-0">
                <Logo size={24} showName />
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-border text-gray-500 dark:text-dark-tertiary transition-colors"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Nav items — close drawer on tap */}
              <div className="flex-1 overflow-y-auto">
                <NavList onItemClick={onClose} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
