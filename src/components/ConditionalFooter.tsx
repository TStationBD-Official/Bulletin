"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  // No footer on admin pages, compose, or the PDF export view
  if (pathname.startsWith("/admin") || pathname === "/compose" || pathname === "/approve" || pathname.endsWith("/pdf")) return null;

  // Home feed uses a fixed-height app-shell layout on lg+ (the feed scrolls
  // independently inside <main>) — a footer placed here, outside that scroll
  // area, would appear via the outer page's own tiny scroll instead of the
  // user actually scrolling through the feed. On lg+, src/app/page.tsx
  // renders its own Footer inside the feed's scroll container instead, so
  // it appears at the real end of the feed. On mobile the whole page scrolls
  // normally, so this global footer already lands correctly after all content.
  if (pathname === "/") return <div className="lg:hidden"><Footer /></div>;

  return <Footer />;
}
