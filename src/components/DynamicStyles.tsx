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

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${a})`;
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
    .dark .bg-brand-900\\/20 { background-color: ${alpha(p, 0.12)} !important; }
    .dark .bg-brand-900\\/30 { background-color: ${alpha(p, 0.18)} !important; }
    .dark .text-brand-400   { color: ${alpha(p, 0.85)} !important; }
    :root { --color-brand: ${p}; }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
