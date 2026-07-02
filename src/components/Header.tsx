"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Bell, PenSquare, LogOut, Bookmark, ChevronDown,
  LayoutDashboard, CheckCheck, HardDrive, User, X, Sparkles,
} from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import {
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToPendingCount,
} from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { relativeTime } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import toast from "react-hot-toast";
import { storeDriveToken, clearDriveToken } from "@/lib/driveAuth";

const NAV_LINKS = [
  { label: "General",     slug: "general"     },
  { label: "Mathematics", slug: "mathematics" },
  { label: "Science",     slug: "science"     },
  { label: "English",     slug: "english"     },
  { label: "Technology",  slug: "technology"  },
  { label: "Study Tips",  slug: "study-tips"  },
  { label: "Q&A",         slug: "qna"         },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user, userRole, userData, notifications, unreadCount,
    accessToken, settings, isAuthLoading,
  } = useStore();

  const [showSearch,    setShowSearch]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [agreedToTerms,   setAgreedToTerms]   = useState(false);
  const [isMac,           setIsMac]           = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  const notifsRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userRole !== "superAdmin") return;
    return subscribeToPendingCount(setPendingCount);
  }, [userRole]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifsRef.current  && !notifsRef.current.contains(e.target as Node))  setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSearch(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearch(false);
      setSearchQuery("");
    }
  };

  const openSignInModal = () => {
    if (settings?.allowNewSignups === false) {
      toast.error("New sign-ups are currently disabled.");
      return;
    }
    setAgreedToTerms(false);
    setShowSignInModal(true);
  };

  const handleSignIn = async () => {
    setShowSignInModal(false);
    try {
      const { GoogleAuthProvider } = await import("firebase/auth");
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        storeDriveToken(result.user.uid, credential.accessToken);
        useStore.getState().setAccessToken(credential.accessToken);
      }
      toast.success(`Welcome, ${result.user.displayName}!`);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") toast.error("Sign in failed");
    }
  };

  const handleSignOut = async () => {
    if (user) clearDriveToken(user.uid);
    await signOut();
    setShowProfile(false);
    toast.success("Signed out");
    router.push("/");
  };

  const displayName = (userData as any)?.name ?? user?.displayName ?? "";
  const photoURL    = (userData as any)?.profileImageUrl ?? user?.photoURL ?? null;

  return (
    <>
      {/* ── Main header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40">
        {/* Glass background layer */}
        <div className="absolute inset-0 bg-white/85 dark:bg-dark-bg/85 backdrop-blur-xl" />
        {/* Gradient bottom border */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-200/80 dark:via-dark-border/80 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 mr-2">
            <Logo size={26} showName />
          </Link>

          {/* Divider */}
          <div className="hidden lg:block h-5 w-px bg-gray-200 dark:bg-dark-border flex-shrink-0" />

          {/* Category nav */}
          <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1">
            {NAV_LINKS.map((cat) => (
              <Link
                key={cat.slug}
                href={`/?c=${cat.slug}`}
                className="px-3 py-1.5 text-[13px] font-medium text-gray-500 dark:text-dark-tertiary hover:text-gray-900 dark:hover:text-dark-primary hover:bg-gray-100/70 dark:hover:bg-dark-card/70 rounded-lg whitespace-nowrap transition-all duration-200"
              >
                {cat.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Theme */}
            <ThemeToggle />

            {/* Search — pill with shortcut hint on desktop */}
            <button
              onClick={() => setShowSearch(true)}
              title={`Search (${isMac ? "⌘K" : "Ctrl+K"})`}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100/80 dark:bg-dark-card/80 border border-gray-200/60 dark:border-dark-border/60 hover:border-gray-300 dark:hover:border-dark-border text-gray-400 dark:text-dark-tertiary hover:text-gray-600 dark:hover:text-dark-secondary transition-all duration-200"
            >
              <Search size={13} />
              <span className="text-[12px] font-medium">Search</span>
              <kbd className="hidden xl:flex items-center text-[10px] font-medium bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded px-1 py-0.5 text-gray-400 dark:text-dark-tertiary shadow-sm">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </button>
            {/* Search icon only on mobile */}
            <button
              onClick={() => setShowSearch(true)}
              title="Search"
              className="sm:hidden p-2 rounded-lg text-gray-500 dark:text-dark-tertiary hover:bg-gray-100 dark:hover:bg-dark-card hover:text-gray-900 dark:hover:text-dark-primary transition-colors"
            >
              <Search size={17} />
            </button>

            {/* Approve — superAdmin only */}
            {userRole === "superAdmin" && (
              <Link
                href="/approve"
                className="relative hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[12px] font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-px"
              >
                <CheckCheck size={13} />
                Approve
                {pendingCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm"
                  >
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </motion.span>
                )}
              </Link>
            )}

            {/* Write */}
            <button
              onClick={() => (user ? router.push("/compose") : openSignInModal())}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-[13px] font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-px"
            >
              <PenSquare size={13} />
              <span className="hidden min-[480px]:inline">Write</span>
            </button>

            {/* Auth state */}
            {isAuthLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-card animate-pulse" />
            ) : user ? (
              <>
                {/* Notifications */}
                <div className="relative" ref={notifsRef}>
                  <button
                    onClick={() => setShowNotifs((v) => !v)}
                    className="relative p-2 rounded-lg text-gray-500 dark:text-dark-tertiary hover:bg-gray-100/80 dark:hover:bg-dark-card/80 hover:text-gray-700 dark:hover:text-dark-secondary transition-all duration-200"
                  >
                    <Bell size={17} />
                    {unreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </motion.span>
                    )}
                  </button>

                  <AnimatePresence>
                    {showNotifs && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[min(22rem,calc(100vw-2rem))] bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 border border-gray-200/60 dark:border-dark-border/60 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-dark-border/60">
                          <div className="flex items-center gap-2">
                            <Bell size={14} className="text-gray-400 dark:text-dark-tertiary" />
                            <h4 className="font-semibold text-gray-900 dark:text-dark-primary text-sm">Notifications</h4>
                            {unreadCount > 0 && (
                              <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                          {unreadCount > 0 && (
                            <button
                              onClick={() => markAllNotificationsRead(user.uid)}
                              className="text-xs bg-brand-500 hover:bg-brand-600 text-white font-semibold px-2.5 py-1 rounded-full transition-colors"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>

                        <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-50 dark:divide-dark-border/40">
                          {notifications.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-12">
                              <Bell size={28} className="text-gray-200 dark:text-dark-muted" />
                              <p className="text-sm text-gray-400 dark:text-dark-tertiary">No notifications yet</p>
                            </div>
                          ) : (
                            notifications.slice(0, 20).map((n) => (
                              <div
                                key={n.id}
                                onClick={() => markNotificationRead(n.id)}
                                className={`relative px-4 py-3.5 pl-5 hover:bg-gray-50 dark:hover:bg-dark-border/40 cursor-pointer transition-colors ${
                                  !n.isRead ? "bg-brand-50 dark:bg-brand-900/30" : ""
                                }`}
                              >
                                {!n.isRead && (
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-brand-500 rounded-full shadow-sm" />
                                )}
                                {n.isUrgent && (
                                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                                    Urgent ·{" "}
                                  </span>
                                )}
                                <p className="text-sm font-semibold text-gray-900 dark:text-dark-primary">{n.title}</p>
                                <p className="text-xs text-gray-500 dark:text-dark-tertiary mt-0.5 leading-relaxed">{n.body}</p>
                                <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mt-1.5">{relativeTime(n.createdAt)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Profile */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setShowProfile((v) => !v)}
                    className="flex items-center gap-1.5 p-1 pr-1.5 rounded-xl hover:bg-gray-100/80 dark:hover:bg-dark-card/80 transition-all duration-200 group"
                  >
                    <div className={`w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 transition-all duration-200 ${
                      showProfile ? "ring-brand-500" : "ring-gray-200 dark:ring-dark-border group-hover:ring-brand-400"
                    }`}>
                      {photoURL ? (
                        <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/30 dark:to-indigo-900/30">
                          <User size={14} className="text-brand-500" />
                        </div>
                      )}
                    </div>
                    <motion.div
                      animate={{ rotate: showProfile ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="hidden sm:block"
                    >
                      <ChevronDown size={13} className="text-gray-400 dark:text-dark-tertiary" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showProfile && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-2.5 w-60 bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 border border-gray-200/60 dark:border-dark-border/60 overflow-hidden"
                      >
                        {/* User card */}
                        <div className="px-4 py-4 bg-gradient-to-br from-gray-50 to-white dark:from-dark-bg/60 dark:to-dark-card border-b border-gray-100 dark:border-dark-border/60">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-brand-200 dark:ring-brand-800">
                              {photoURL ? (
                                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/30 dark:to-indigo-900/30">
                                  <User size={16} className="text-brand-500" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-dark-primary text-sm truncate">{displayName}</p>
                              <p className="text-xs text-gray-400 dark:text-dark-tertiary capitalize mt-0.5">{userRole?.replace(/_/g, " ")}</p>
                            </div>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="py-1.5">
                          {[
                            { href: "/profile", icon: User, label: "My Profile" },
                            { href: "/profile?tab=drive", icon: HardDrive, label: "Drive & Storage", badge: accessToken ? "ON" : "OFF", badgeOk: !!accessToken },
                            { href: "/saved", icon: Bookmark, label: "Saved Posts" },
                            ...(userRole === "feeds_user" || userRole === "admin"
                              ? [
                                  { href: "/compose", icon: PenSquare, label: "Write Post" },
                                ]
                              : []),
                            ...(userRole === "superAdmin"
                              ? [{ href: "/admin", icon: LayoutDashboard, label: "Admin Dashboard" }]
                              : []),
                          ].map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setShowProfile(false)}
                              className="flex items-center justify-between mx-1.5 px-3 py-2.5 text-sm text-gray-700 dark:text-dark-secondary hover:bg-gray-100/70 dark:hover:bg-dark-border/60 rounded-xl transition-colors"
                            >
                              <span className="flex items-center gap-2.5">
                                <item.icon size={14} className="text-gray-400 dark:text-dark-tertiary" />
                                {item.label}
                              </span>
                              {"badge" in item && item.badge && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  item.badgeOk
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-500"
                                }`}>
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-gray-100 dark:border-dark-border/60 p-1.5">
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                          >
                            <LogOut size={14} /> Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <button
                onClick={openSignInModal}
                className="px-4 py-1.5 text-[13px] font-semibold text-gray-700 dark:text-dark-secondary border border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-card/80 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-card hover:border-gray-300 dark:hover:border-dark-border/80 transition-all duration-200 shadow-sm"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Search overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4"
            onClick={() => setShowSearch(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 border border-gray-200/60 dark:border-dark-border/60 overflow-hidden"
            >
              <form onSubmit={handleSearch} className="flex items-center gap-3 px-5 py-4">
                <Search size={17} className="text-gray-400 dark:text-dark-tertiary flex-shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search posts, authors…"
                  className="flex-1 bg-transparent text-[15px] text-gray-900 dark:text-dark-primary placeholder-gray-400 dark:placeholder-dark-tertiary focus:outline-none"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 transition-colors">
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSearch(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 transition-colors ml-1"
                >
                  <kbd className="text-[11px] font-medium text-gray-400 dark:text-dark-tertiary border border-gray-200 dark:border-dark-border rounded px-1.5 py-0.5">Esc</kbd>
                </button>
              </form>
              <div className="px-5 py-2.5 bg-gray-50/80 dark:bg-dark-bg/40 border-t border-gray-100 dark:border-dark-border/60 flex items-center gap-2">
                <Sparkles size={11} className="text-gray-300 dark:text-dark-muted flex-shrink-0" />
                <p className="text-xs text-gray-400 dark:text-dark-tertiary">Press <span className="font-medium text-gray-500 dark:text-dark-secondary">Enter</span> to search across all posts and authors</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sign-in consent modal ──────────────────────────────── */}
      <AnimatePresence>
        {showSignInModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSignInModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl shadow-black/20 border border-gray-200/60 dark:border-dark-border/60 w-full max-w-sm p-6 flex flex-col gap-5"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-50 to-indigo-50 dark:from-brand-900/20 dark:to-indigo-900/20 flex items-center justify-center mx-auto mb-3 shadow-sm border border-gray-100 dark:border-dark-border">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-dark-primary">Sign in to Bulletin</h2>
                <p className="text-sm text-gray-500 dark:text-dark-tertiary mt-1">Join the community and start writing</p>
              </div>

              <div className="bg-gray-50 dark:bg-dark-bg/60 rounded-xl p-4 text-sm text-gray-600 dark:text-dark-secondary space-y-2 border border-gray-100 dark:border-dark-border/60">
                {settings?.termsOfService?.trim() && (
                  <div className="flex items-center gap-2">
                    <span>📄</span>
                    <Link href="/terms" target="_blank" className="hover:text-brand-500 underline underline-offset-2 transition-colors">Terms of Service</Link>
                  </div>
                )}
                {settings?.privacyPolicy?.trim() && (
                  <div className="flex items-center gap-2">
                    <span>🔒</span>
                    <Link href="/privacy" target="_blank" className="hover:text-brand-500 underline underline-offset-2 transition-colors">Privacy Policy</Link>
                  </div>
                )}
                {!settings?.termsOfService?.trim() && !settings?.privacyPolicy?.trim() && (
                  <p className="text-gray-400 dark:text-dark-tertiary text-xs">By signing in you agree to use this platform responsibly.</p>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand-500 rounded flex-shrink-0"
                />
                <span className="text-sm text-gray-700 dark:text-dark-secondary">
                  I have read and agree to the{" "}
                  {settings?.termsOfService?.trim() && (
                    <Link href="/terms" target="_blank" className="text-brand-500 hover:underline">Terms of Service</Link>
                  )}
                  {settings?.termsOfService?.trim() && settings?.privacyPolicy?.trim() && " and "}
                  {settings?.privacyPolicy?.trim() && (
                    <Link href="/privacy" target="_blank" className="text-brand-500 hover:underline">Privacy Policy</Link>
                  )}
                  {!settings?.termsOfService?.trim() && !settings?.privacyPolicy?.trim() && "platform guidelines"}
                </span>
              </label>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleSignIn}
                  disabled={!agreedToTerms}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold whitespace-nowrap bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" className="flex-shrink-0">
                    <path fill="white" fillOpacity="0.9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="white" fillOpacity="0.9" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="white" fillOpacity="0.9" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="white" fillOpacity="0.9" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
                <button
                  onClick={() => setShowSignInModal(false)}
                  className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-dark-secondary border border-gray-200 dark:border-dark-border rounded-xl hover:bg-gray-50 dark:hover:bg-dark-border/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
