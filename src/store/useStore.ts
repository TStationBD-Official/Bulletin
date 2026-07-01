import { create } from "zustand";
import { User } from "firebase/auth";
import { UserRole, FeedsUser, AppUser, Notification, AppSettings } from "@/types";

interface StoreState {
  // Auth
  user: User | null;
  userRole: UserRole | null;
  userData: FeedsUser | AppUser | null;
  accessToken: string | null;
  isAuthLoading: boolean;

  // Notifications
  notifications: Notification[];
  unreadCount: number;

  // Admin
  pendingPostsCount: number;

  // Site settings (loaded once globally)
  settings: AppSettings | null;

  // Actions
  setUser: (
    user: User | null,
    role: UserRole | null,
    userData: FeedsUser | AppUser | null,
    accessToken?: string | null
  ) => void;
  setAccessToken: (token: string | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  setPendingPostsCount: (count: number) => void;
  setSettings: (settings: AppSettings) => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  userRole: null,
  userData: null,
  accessToken: null,
  isAuthLoading: true,
  notifications: [],
  unreadCount: 0,
  pendingPostsCount: 0,
  settings: null,

  setUser: (user, role, userData, accessToken = null) =>
    set({ user, userRole: role, userData, accessToken, isAuthLoading: false }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),

  markNotificationRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.isRead).length,
      };
    }),

  setPendingPostsCount: (pendingPostsCount) => set({ pendingPostsCount }),

  setSettings: (settings) => set({ settings }),

  reset: () =>
    set({
      user: null,
      userRole: null,
      userData: null,
      accessToken: null,
      isAuthLoading: false,
      notifications: [],
      unreadCount: 0,
    }),
}));
