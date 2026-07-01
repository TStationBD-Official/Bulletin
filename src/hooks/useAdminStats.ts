"use client";

import { useEffect } from "react";
import { subscribeToPendingCount } from "@/lib/firestore";
import { useStore } from "@/store/useStore";

export function useAdminPendingCount() {
  const { user, userRole, setPendingPostsCount } = useStore();

  useEffect(() => {
    if (!user || userRole !== "superAdmin") return;

    const unsubscribe = subscribeToPendingCount((count) => {
      setPendingPostsCount(count);
    });

    return () => unsubscribe();
  }, [user?.uid, userRole]);
}
