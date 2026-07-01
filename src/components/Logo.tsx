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
  const siteTitle = settings?.siteTitle || "Bulletin";

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
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id={`${uid}-paper`} x1="0" y1="12" x2="0" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.2" />
            </filter>
            <radialGradient id={`${uid}-shine`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor="black" stopOpacity="0.1" />
            </radialGradient>
          </defs>
          <rect width="40" height="40" rx="10" fill={`url(#${uid}-bg)`} />
          <rect width="40" height="20" rx="10" fill="white" opacity="0.04" />
          <g transform="rotate(-6, 20, 24)" filter={`url(#${uid}-shadow)`}>
            <rect x="9" y="13" width="22" height="22" rx="2.5" fill={`url(#${uid}-paper)`} />
            <rect x="13" y="18" width="14" height="2.2" rx="1.1" fill="#94a3b8" />
            <rect x="13" y="22.5" width="10" height="2.2" rx="1.1" fill="#94a3b8" />
            <rect x="13" y="27" width="12" height="2.2" rx="1.1" fill="#94a3b8" />
          </g>
          <rect x="19.2" y="11" width="1.6" height="9" rx="0.8" fill="#fbbf24" opacity="0.9" />
          <circle cx="20" cy="10" r="5.5" fill="#f59e0b" opacity="0.3" />
          <circle cx="20" cy="10" r="4.5" fill="#f59e0b" />
          <circle cx="20" cy="10" r="4.5" fill={`url(#${uid}-shine)`} />
          <circle cx="18.5" cy="8.5" r="1.5" fill="white" opacity="0.5" />
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
