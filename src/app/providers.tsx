"use client";

import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useAdminPendingCount } from "@/hooks/useAdminStats";
import { useSettings } from "@/hooks/useSettings";
import DynamicStyles from "@/components/DynamicStyles";
import AdRepositioner from "@/components/AdRepositioner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  },
});

function AuthProvider({ children }: { children: ReactNode }) {
  useAuth();
  useNotifications();
  useAdminPendingCount();
  useSettings();
  return (
    <>
      <DynamicStyles />
      {children}
    </>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster position="bottom-right" />
        <AdRepositioner />
      </AuthProvider>
    </QueryClientProvider>
  );
}
