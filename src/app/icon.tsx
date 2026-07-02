import { cookies } from "next/headers";

export const size = { width: 40, height: 40 };
export const contentType = "image/svg+xml";

// Matches the --color-brand-900 / --color-brand-600 pairs defined per
// [data-accent] in src/app/globals.css, so the favicon matches whichever
// accent the visitor has selected (mirrored into a cookie by useTheme.ts).
const GRADIENTS: Record<string, [string, string]> = {
  blue:    ["#1e3a8a", "#2563eb"],
  violet:  ["#4c1d95", "#7c3aed"],
  emerald: ["#064e3b", "#059669"],
  orange:  ["#7c2d12", "#ea580c"],
  rose:    ["#881337", "#e11d48"],
};

export default function Icon() {
  const accent = cookies().get("accent")?.value ?? "blue";
  const [from, to] = GRADIENTS[accent] ?? GRADIENTS.blue;

  const svg = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
  </defs>
  <rect width="40" height="40" rx="10" fill="url(#bg)" />
  <rect width="40" height="20" rx="10" fill="white" opacity="0.05" />
  <rect x="9" y="13" width="22" height="4" rx="2" fill="white" />
  <rect x="9" y="19" width="16" height="4" rx="2" fill="white" opacity="0.75" />
  <rect x="9" y="25" width="11" height="4" rx="2" fill="white" opacity="0.5" />
  <circle cx="31.5" cy="9.5" r="4.5" fill="#f59e0b" opacity="0.25" />
  <circle cx="31.5" cy="9.5" r="3" fill="#fbbf24" />
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
