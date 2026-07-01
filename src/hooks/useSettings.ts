"use client";

import { useEffect } from "react";
import { getSettings } from "@/lib/firestore";
import { useStore } from "@/store/useStore";

export function useSettings() {
  const { setSettings } = useStore();

  useEffect(() => {
    getSettings().then((s) => {
      if (!s) return;
      setSettings(s);
      if (s.siteTitle) document.title = s.siteTitle;
    }).catch(() => {});
  }, []);
}
