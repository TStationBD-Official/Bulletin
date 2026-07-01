"use client";

import { useEffect } from "react";
import { subscribeToNotifications } from "@/lib/firestore";
import { useStore } from "@/store/useStore";

export function useNotifications() {
  const { user, setNotifications } = useStore();

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user?.uid]);
}
