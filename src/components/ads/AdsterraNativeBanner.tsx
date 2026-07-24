"use client";

import { useEffect, useRef } from "react";

const CONTAINER_ID = "container-0c876caf5d3c7223c858b2b691013660";

/** Adsterra native banner — renders as a content card, so it's placed
    inline in the feed rather than the fixed-width sidebar. Fluid width by
    design, so it reflows naturally on any screen size. */
export default function AdsterraNativeBanner() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || wrap.dataset.loaded) return;
    wrap.dataset.loaded = "true";

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = "https://pl30509827.effectivecpmnetwork.com/0c876caf5d3c7223c858b2b691013660/invoke.js";
    wrap.appendChild(script);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-full mb-6 p-3 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden"
    >
      <div id={CONTAINER_ID} className="w-full" />
    </div>
  );
}
