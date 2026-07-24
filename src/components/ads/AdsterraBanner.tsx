"use client";

import { useEffect, useRef, useState } from "react";

const AD_KEY = "0dcc7e351547872ea57f0477ce1ac17c";
const LOAD_TIMEOUT_MS = 6000;

/** Adsterra 468x60 banner. Fixed pixel size — 468px doesn't fit most phone
    viewports, so this is hidden below the `sm` breakpoint rather than
    squeezed/scaled, which would just break the ad's own iframe layout. */
export default function AdsterraBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [noFill, setNoFill] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.dataset.loaded) return;
    container.dataset.loaded = "true";

    // IMPORTANT: the container must stay visible while the ad script runs —
    // most ad networks detect a hidden/zero-size slot and simply refuse to
    // render into it (anti-fraud check), so hiding it up front means it can
    // never fill. Only collapse it after confirming, post-timeout, that
    // nothing came back.
    const hasCreative = () => Array.from(container.children).some((el) => el.tagName !== "SCRIPT");

    const configScript = document.createElement("script");
    configScript.type = "text/javascript";
    configScript.text = `
      atOptions = {
        'key' : '${AD_KEY}',
        'format' : 'iframe',
        'height' : 60,
        'width' : 468,
        'params' : {}
      };
    `;
    const invokeScript = document.createElement("script");
    invokeScript.src = `https://www.highperformanceformat.com/${AD_KEY}/invoke.js`;
    invokeScript.async = true;

    container.appendChild(configScript);
    container.appendChild(invokeScript);

    const timeout = setTimeout(() => {
      if (!hasCreative()) setNoFill(true);
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, []);

  if (noFill) return null;

  return (
    <div className="hidden sm:flex flex-col items-center gap-1 py-2">
      <span className="text-[9px] font-semibold tracking-widest uppercase text-gray-300 dark:text-dark-muted">
        Advertisement
      </span>
      {/* Creative is blurred (not the script/iframe itself) — the ad still
          loads and counts impressions/clicks normally, this just softens
          whatever the network happens to serve so nothing explicit renders
          clearly, even when the network is set to "mainstream" only. */}
      <div
        ref={containerRef}
        style={{ width: 468, height: 60, filter: "blur(24px)", pointerEvents: "auto" }}
      />
    </div>
  );
}
