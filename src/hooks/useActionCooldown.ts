import { useRef } from "react";

/** Guards against rapid repeated clicks (e.g. spam-clicking like/save/share). */
export function useActionCooldown(ms = 800) {
  const lastRef = useRef(0);
  return (fn: () => void | Promise<void>) => {
    const now = Date.now();
    if (now - lastRef.current < ms) return;
    lastRef.current = now;
    fn();
  };
}
