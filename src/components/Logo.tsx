"use client";

import { useId, useState } from "react";
import { useStore } from "@/store/useStore";

interface LogoProps {
  size?: number;
  showName?: boolean;
  className?: string;
}

export default function Logo({ size = 32, showName = true, className = "" }: LogoProps) {
  const { settings } = useStore();
  const logoUrl   = settings?.logoUrl?.trim() || "";
  const siteTitle = settings?.siteTitle || "The Net Chronicle";

  const [imgError, setImgError] = useState(false);

  // Unique prefix per instance so SVG gradient IDs don't collide across the page
  const uid = useId().replace(/:/g, "");

  const showSvg = !logoUrl || imgError;

  return (
    <div className={`flex items-center gap-2.5 ${className}`} style={{ lineHeight: 1 }} suppressHydrationWarning>
      {showSvg ? (
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
          aria-label={siteTitle}
        >
          <defs>
            <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" style={{ stopColor: "rgb(var(--color-brand-900))" }} />
              <stop offset="100%" style={{ stopColor: "rgb(var(--color-brand-600))" }} />
            </linearGradient>
          </defs>
          {/* Badge */}
          <rect width="40" height="40" rx="10" fill={`url(#${uid}-bg)`} />
          <rect width="40" height="20" rx="10" fill="white" opacity="0.05" />

          {/* Stacked feed bars */}
          <rect x="9" y="13" width="22" height="4" rx="2" fill="white" />
          <rect x="9" y="19" width="16" height="4" rx="2" fill="white" opacity="0.75" />
          <rect x="9" y="25" width="11" height="4" rx="2" fill="white" opacity="0.5" />

          {/* Live/new accent dot */}
          <circle cx="31.5" cy="9.5" r="4.5" fill="#f59e0b" opacity="0.25" />
          <circle cx="31.5" cy="9.5" r="3" fill="#fbbf24" />
        </svg>
      ) : (
        <img
          src={logoUrl}
          alt={siteTitle}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="rounded-lg object-contain flex-shrink-0"
          style={{ width: size, height: size }}
        />
      )}

      {showName && (
        <span
          className="font-bold tracking-tight text-gray-900 dark:text-white select-none"
          style={{ fontSize: size * 0.5, lineHeight: 1 }}
        >
          {siteTitle}
        </span>
      )}
    </div>
  );
}
