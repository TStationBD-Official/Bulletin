"use client";

import { cn } from "@/lib/utils";

/* ── Gradient arc SVG spinner ───────────────────────────── */
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizePx = { sm: 20, md: 36, lg: 52 };

export default function LoadingSpinner({
  size = "md",
  className,
}: LoadingSpinnerProps) {
  const px = sizePx[size];
  const r  = (px / 2) * 0.72;
  const sw = size === "sm" ? 2.5 : size === "md" ? 3 : 3.5;
  const circ = 2 * Math.PI * r;
  const id   = `sg-${size}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      className={cn("animate-spin", className)}
      style={{ animationDuration: "0.75s", animationTimingFunction: "linear" }}
      aria-label="Loading"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0" />
          <stop offset="60%"  stopColor="#3b82f6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={px / 2}
        cy={px / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        className="text-gray-200 dark:text-dark-border"
      />
      {/* Arc */}
      <circle
        cx={px / 2}
        cy={px / 2}
        r={r}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.72} ${circ * 0.28}`}
        strokeDashoffset={circ * 0.25}
      />
    </svg>
  );
}

/* ── Bouncing dot ───────────────────────────────────────── */
function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500"
      style={{
        animation: "bounce 1.2s ease-in-out infinite",
        animationDelay: `${delay}s`,
      }}
    />
  );
}

/* ── Page-level loader ──────────────────────────────────── */
export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 select-none">
      {/* Brand wordmark */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-brand-600 to-indigo-500 bg-clip-text text-transparent">
          Bulletin
        </span>
        <span className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-dark-muted">
          Loading
        </span>
      </div>

      {/* Gradient spinner */}
      <LoadingSpinner size="lg" />

      {/* Bouncing dots */}
      <div className="flex items-center gap-2">
        <Dot delay={0} />
        <Dot delay={0.2} />
        <Dot delay={0.4} />
      </div>
    </div>
  );
}

/* ── Skeleton shimmer card (feed placeholder) ───────────── */
export function SkeletonCard() {
  return (
    <div className="flex flex-col p-5 md:p-6 mb-3 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border animate-pulse">
      {/* header row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-dark-card-2 shrink-0" />
        <div className="h-3 w-28 rounded-full bg-gray-200 dark:bg-dark-card-2" />
        <div className="h-3 w-16 rounded-full bg-gray-100 dark:bg-dark-border ml-auto" />
      </div>
      {/* content + thumb */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-full rounded-full bg-gray-200 dark:bg-dark-card-2" />
          <div className="h-4 w-4/5 rounded-full bg-gray-200 dark:bg-dark-card-2" />
          <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-dark-border mt-1" />
          <div className="h-3 w-3/4 rounded-full bg-gray-100 dark:bg-dark-border" />
        </div>
        <div className="w-24 h-24 rounded-xl bg-gray-200 dark:bg-dark-card-2 shrink-0" />
      </div>
      {/* footer */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-gray-50 dark:border-dark-border/60">
        <div className="h-3 w-12 rounded-full bg-gray-100 dark:bg-dark-border" />
        <div className="h-3 w-12 rounded-full bg-gray-100 dark:bg-dark-border" />
        <div className="h-3 w-12 rounded-full bg-gray-100 dark:bg-dark-border" />
      </div>
    </div>
  );
}

/* ── Feed skeleton (3 cards) ────────────────────────────── */
export function FeedSkeleton() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
