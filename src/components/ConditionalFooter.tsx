"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  // No footer on admin pages or compose
  if (pathname.startsWith("/admin") || pathname === "/compose" || pathname === "/approve") return null;
  return <Footer />;
}
