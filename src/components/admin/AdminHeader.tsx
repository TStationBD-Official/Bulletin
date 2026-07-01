"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LogOut, User, Shield, CheckCheck, Menu } from "lucide-react";
import { signOut } from "@/lib/auth";
import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Logo from "@/components/Logo";

interface AdminHeaderProps {
  onMenuToggle: () => void;
}

export default function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  const { user, userData, pendingPostsCount } = useStore();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    toast.success("Signed out");
  };

  const name  = (userData as any)?.name ?? user?.displayName ?? "Admin";
  const photo = (userData as any)?.profileImageUrl ?? user?.photoURL ?? null;

  return (
    <header className="h-16 bg-white dark:bg-dark-card border-b border-gray-100 dark:border-dark-border flex items-center px-4 sm:px-6 gap-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-border text-gray-500 dark:text-dark-tertiary transition-colors flex-shrink-0"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      <Link href="/" className="flex-shrink-0">
        <Logo size={26} showName />
      </Link>

      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-admin-50 dark:bg-admin-900/20 rounded-full flex-shrink-0">
        <Shield size={13} className="text-admin-600 dark:text-admin-400" />
        <span className="text-xs font-bold text-admin-700 dark:text-admin-400 uppercase tracking-wide">
          Super Admin
        </span>
      </div>

      <Link
        href="/approve"
        className="relative hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-full transition-colors flex-shrink-0"
      >
        <CheckCheck size={14} />
        Approve
        {pendingPostsCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
          >
            {pendingPostsCount > 99 ? "99+" : pendingPostsCount}
          </motion.span>
        )}
      </Link>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-dark-border flex-shrink-0">
            {photo ? (
              <img src={photo} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-admin-100 dark:bg-admin-900/20">
                <User size={16} className="text-admin-500" />
              </div>
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-gray-900 dark:text-dark-primary">{name}</p>
            <p className="text-[10px] text-gray-400 dark:text-dark-tertiary">Super Admin</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
