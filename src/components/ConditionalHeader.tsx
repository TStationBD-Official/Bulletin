"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

export default function ConditionalHeader() {
  const pathname = usePathname();
  // Admin pages have their own AdminHeader — skip the main Header there
  if (pathname.startsWith("/admin")) return null;
  // PDF export view is a clean print-only layout — no site chrome
  if (pathname.endsWith("/pdf")) return null;
  return <Header />;
}
