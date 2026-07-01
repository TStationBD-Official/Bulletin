"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { useStore } from "@/store/useStore";
import { PageLoader } from "@/components/LoadingSpinner";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, userRole, isAuthLoading } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && (!user || userRole !== "superAdmin")) {
      router.push("/");
    }
  }, [user?.uid, userRole, isAuthLoading, router]);

  if (isAuthLoading) return <PageLoader />;
  if (!user || userRole !== "superAdmin") return null;

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader onMenuToggle={() => setMobileMenuOpen((v) => !v)} />
      <div className="flex flex-1">
        <AdminSidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
