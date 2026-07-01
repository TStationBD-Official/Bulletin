import type { Config } from "tailwindcss";

/**
 * Reads a "R G B" CSS custom property (set per accent theme in globals.css)
 * so brand-* utilities stay swappable at runtime while still supporting
 * Tailwind's `/opacity` modifier (e.g. bg-brand-900/20).
 */
function withOpacity(cssVar: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue !== undefined
      ? `rgb(var(${cssVar}) / ${opacityValue})`
      : `rgb(var(${cssVar}))`;
}

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Georgia", "serif"],
        mono: ["Courier New", "monospace"],
      },
      colors: {
        // Tailwind's Config type predates the documented function-value color
        // form, so this needs a cast — see https://tailwindcss.com/docs/customizing-colors#using-css-variables
        brand: {
          50:  withOpacity("--color-brand-50"),
          100: withOpacity("--color-brand-100"),
          200: withOpacity("--color-brand-200"),
          300: withOpacity("--color-brand-300"),
          400: withOpacity("--color-brand-400"),
          500: withOpacity("--color-brand-500"),
          600: withOpacity("--color-brand-600"),
          700: withOpacity("--color-brand-700"),
          800: withOpacity("--color-brand-800"),
          900: withOpacity("--color-brand-900"),
          950: withOpacity("--color-brand-950"),
        } as unknown as Record<string, string>,
        indigo: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        admin: {
          50:  "#fff7ed",
          100: "#ffedd5",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          900: "#7c2d12",
        },
        dark: {
          bg:        "#0d1526",   // deep navy page background
          card:      "#162032",   // slightly lighter card surface
          "card-2":  "#1c2a3e",   // elevated card (modals, dropdowns)
          border:    "#243347",   // subtle borders
          "border-2":"#2e4060",   // stronger borders / dividers
          primary:   "#f0f4f8",   // near-white primary text
          secondary: "#c4d0de",   // secondary text
          tertiary:  "#8ba1b8",   // muted/meta text (raised from #94a3b8)
          muted:     "#5c7a96",   // very muted, timestamps etc.
        },
      },
      animation: {
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "pageIn 0.4s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        pageIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
        "card-hover":
          "0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
