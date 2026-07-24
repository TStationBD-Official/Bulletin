"use client";

import { useEffect, useRef, useState } from "react";

const CONTAINER_ID = "container-0c876caf5d3c7223c858b2b691013660";
const LOAD_TIMEOUT_MS = 6000;

/** Adsterra native banner — renders as a content card, so it's placed
    inline in the feed rather than the fixed-width sidebar. Fluid width by
    design, so it reflows naturally on any screen size. */
export default function AdsterraNativeBanner() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const adRef = useRef<HTMLDivElement>(null);
  const [noFill, setNoFill] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const ad = adRef.current;
    if (!wrap || !ad || wrap.dataset.loaded) return;
    wrap.dataset.loaded = "true";

    // Same rule as the fixed banner: keep the slot visible while the script
    // runs, since most ad networks refuse to fill a hidden/zero-size slot.
    // Only collapse it once we've confirmed, after a timeout, nothing filled.
    //
    // A plain childElementCount check isn't enough — on a no-fill response
    // the network can still drop in an empty wrapper node with zero visible
    // content, which would satisfy "has children" without ever showing an
    // actual ad. Require real rendered height or an actual media/link tag.
    const hasRealContent = () =>
      ad.offsetHeight > 20 || !!ad.querySelector("img, a, iframe");

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = "https://pl30509827.effectivecpmnetwork.com/0c876caf5d3c7223c858b2b691013660/invoke.js";
    wrap.appendChild(script);

    const timeout = setTimeout(() => {
      if (!hasRealContent()) setNoFill(true);
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, []);

  if (noFill) return null;

  return (
    <div
      ref={wrapRef}
      className="w-full mb-6 p-3 bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden"
    >
      <span className="block mb-1.5 text-[9px] font-semibold tracking-widest uppercase text-gray-300 dark:text-dark-muted">
        Advertisement
      </span>
      {/* Blur is stronger here than the fixed 468x60 banner — native ad cards
          can render much larger (big thumbnail + headline), so a small blur
          radius wouldn't be enough to fully obscure it. */}
      <div id={CONTAINER_ID} ref={adRef} className="w-full" style={{ filter: "blur(40px)", pointerEvents: "auto" }} />
    </div>
  );
}
