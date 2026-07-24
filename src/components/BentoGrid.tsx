"use client";

import { motion, Variants } from "framer-motion";
import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

const tileVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

interface BentoGridProps {
  children: ReactNode;
  className?: string;
  /** Raw Tailwind grid-template class string, e.g. "grid-cols-1 md:grid-cols-4 lg:grid-cols-6" */
  cols?: string;
}

export function BentoGrid({ children, className, cols = "grid-cols-1" }: BentoGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className={cn("grid gap-4 md:gap-5", cols, className)}
    >
      {children}
    </motion.div>
  );
}

interface BentoTileProps {
  children: ReactNode;
  className?: string;
  /** Raw Tailwind col-span class string, e.g. "col-span-1 lg:col-span-2" */
  colSpan?: string;
  /** Raw Tailwind row-span class string, e.g. "row-span-1 lg:row-span-2" */
  rowSpan?: string;
  /** Skip the default card chrome for tiles that supply their own background/border */
  bare?: boolean;
  as?: "div" | "article";
  onClick?: () => void;
  style?: CSSProperties;
  /** Skip the stagger-in-from-parent-viewport animation — for tiles that can
      mount well after the BentoGrid's own whileInView has already fired
      (e.g. content that arrives from a slower async fetch), which would
      otherwise leave them stuck at the animation's hidden (opacity: 0) state. */
  noAnimate?: boolean;
}

export function BentoTile({
  children,
  className,
  colSpan = "col-span-1",
  rowSpan = "row-span-1",
  bare = false,
  as = "div",
  onClick,
  style,
  noAnimate = false,
}: BentoTileProps) {
  const Comp = as === "article" ? motion.article : motion.div;
  return (
    <Comp
      variants={tileVariants}
      initial={noAnimate ? false : undefined}
      onClick={onClick}
      style={style}
      className={cn(
        colSpan,
        rowSpan,
        !bare &&
          "bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border shadow-card hover:shadow-card-hover transition-shadow duration-200 p-5 md:p-6",
        className
      )}
    >
      {children}
    </Comp>
  );
}
