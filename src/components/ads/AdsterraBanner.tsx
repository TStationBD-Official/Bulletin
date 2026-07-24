"use client";

import { useEffect, useRef } from "react";

const AD_KEY = "0dcc7e351547872ea57f0477ce1ac17c";

/** Adsterra 468x60 banner. Fixed pixel size — 468px doesn't fit most phone
    viewports, so this is hidden below the `sm` breakpoint rather than
    squeezed/scaled, which would just break the ad's own iframe layout. */
export default function AdsterraBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.dataset.loaded) return;
    container.dataset.loaded = "true";

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
  }, []);

  return (
    <div className="hidden sm:flex justify-center py-2">
      <div ref={containerRef} style={{ width: 468, height: 60 }} />
    </div>
  );
}
