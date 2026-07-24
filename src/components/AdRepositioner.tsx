"use client";

import { useEffect, useRef } from "react";

const TOP_THRESHOLD_PX = 500;
const MAX_WIDTH_PX = 600;
const BASE_BOTTOM_PX = 20;
const STACK_GAP_PX = 16;

/** Monetag's in-page push notification widget renders as an <iframe>, but the
    actual position:fixed styling usually lives on a wrapping <div> around it
    (not the iframe itself), set inline by their script — often with
    !important. We can't touch content inside the iframe, but we CAN rewrite
    that wrapper's own inline style via the CSSOM, which wins over their
    !important because it's the same style attribute and we write it last.

    Walks up from every iframe on the page to find its nearest fixed-position
    ancestor, and only touches ones that look like a small corner notification
    (narrow, anchored near the top, no bottom already set) — this site has
    other position:fixed elements (modals, overlays) that must not be
    touched, but none of those contain an iframe, so this stays scoped. */
function findFixedAncestor(el: HTMLElement, maxDepth = 8): HTMLElement | null {
  let node: HTMLElement | null = el;
  for (let i = 0; i < maxDepth && node && node !== document.body; i++) {
    if (window.getComputedStyle(node).position === "fixed") return node;
    node = node.parentElement;
  }
  return null;
}

export default function AdRepositioner() {
  const stackOffsetRef = useRef(BASE_BOTTOM_PX);

  useEffect(() => {
    const tryReposition = (iframe: HTMLIFrameElement) => {
      const target = findFixedAncestor(iframe);
      if (!target || target.dataset.repositioned) return;

      const cs = window.getComputedStyle(target);
      const top = parseFloat(cs.top);
      const width = target.offsetWidth;
      const hasBottom = cs.bottom !== "auto";

      if (!isNaN(top) && top >= 0 && top < TOP_THRESHOLD_PX && width > 0 && width < MAX_WIDTH_PX && !hasBottom) {
        target.dataset.repositioned = "true";
        target.style.setProperty("top", "auto", "important");
        target.style.setProperty("bottom", `${stackOffsetRef.current}px`, "important");
        // Stack any further notification card above this one instead of overlapping it.
        stackOffsetRef.current += target.offsetHeight + STACK_GAP_PX;
      }
    };

    const scanAll = () => {
      document.querySelectorAll("iframe").forEach((f) => tryReposition(f as HTMLIFrameElement));
    };

    scanAll();

    const observer = new MutationObserver(scanAll);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
