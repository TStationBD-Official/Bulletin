"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

function darken(hex: string, amount = 15): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

/** A brand-hued variant guaranteed to read on dark backgrounds — admins can
    pick any primary color (including near-black), so text/icons/small filled
    shapes that use it need a floor on lightness or they vanish in dark mode. */
function forDarkBg(hex: string): string {
  let out = hex;
  for (let i = 0; i < 8 && luminance(out) < 0.5; i++) out = lighten(out, 40);
  return out;
}

export default function DynamicStyles() {
  const { settings } = useStore();

  // Apply siteDescription to <meta name="description">
  useEffect(() => {
    if (!settings?.siteDescription) return;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    tag.content = settings.siteDescription;
  }, [settings?.siteDescription]);

  const primary = settings?.primaryColor || null;
  if (!primary) return null;

  const p  = primary;
  const pd = darken(p, 20);

  // Dark-mode-safe variants: lightened until legible on dark backgrounds,
  // so an admin-chosen dark/black brand color doesn't go invisible.
  const pDark      = forDarkBg(p);
  const pDarkHover = lighten(pDark, 20);

  const css = `
    .bg-brand-500  { background-color: ${p}  !important; }
    .bg-brand-600  { background-color: ${pd} !important; }
    .bg-brand-50   { background-color: ${alpha(p, 0.08)} !important; }
    .bg-brand-100  { background-color: ${alpha(p, 0.15)} !important; }
    .text-brand-500 { color: ${p}  !important; }
    .text-brand-600 { color: ${pd} !important; }
    .text-brand-400 { color: ${alpha(p, 0.8)} !important; }
    .border-brand-500 { border-color: ${p}  !important; }
    .ring-brand-500, .focus\\:ring-brand-500:focus { --tw-ring-color: ${p} !important; }
    .hover\\:bg-brand-600:hover   { background-color: ${pd} !important; }
    .hover\\:text-brand-600:hover { color: ${pd} !important; }
    .hover\\:bg-brand-50:hover   { background-color: ${alpha(p, 0.08)} !important; }
    .hover\\:text-brand-400:hover { color: ${alpha(p, 0.8)} !important; }
    .dark .bg-brand-900\\/20 { background-color: ${alpha(pDark, 0.12)} !important; }
    .dark .bg-brand-900\\/30 { background-color: ${alpha(pDark, 0.18)} !important; }
    .dark .text-brand-400   { color: ${alpha(pDark, 0.9)} !important; }
    .dark .text-brand-500   { color: ${pDark} !important; }
    .dark .text-brand-600   { color: ${pDark} !important; }
    .dark .bg-brand-500     { background-color: ${pDark} !important; }
    .dark .border-brand-500 { border-color: ${pDark} !important; }
    .dark .hover\\:text-brand-400:hover { color: ${pDarkHover} !important; }
    .dark .hover\\:text-brand-600:hover { color: ${pDarkHover} !important; }
    :root { --color-brand: ${p}; }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
