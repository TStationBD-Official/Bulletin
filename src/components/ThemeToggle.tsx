"use client";

import { useState } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme, ACCENTS } from "@/store/useTheme";

const themes = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark"  as const, label: "Dark",  icon: Moon },
  { value: "auto"  as const, label: "Auto",  icon: Laptop },
];

export default function ThemeToggle() {
  const [open, setOpen] = useState(false);
  const { theme, isDark, setTheme, accent, setAccent } = useTheme();

  const handleThemeChange = (newTheme: "light" | "dark" | "auto") => {
    setTheme(newTheme);
    setOpen(false);
  };

  const currentTheme = themes.find((t) => t.value === theme) ?? themes[0];

  // Explicit colours so the dropdown is readable regardless of dark/light mode
  const dropdownBg  = isDark ? "#1e2330" : "#ffffff";
  const borderColor = isDark ? "#2d3348" : "#e5e7eb";
  const textDefault = isDark ? "#c9d1d9" : "#374151";
  const textActive  = isDark ? "#818cf8" : "#6366f1";
  const bgActive    = isDark ? "rgba(99,102,241,0.15)" : "#eef2ff";
  const bgHover     = isDark ? "#2d3348" : "#f3f4f6";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
        title="Toggle theme"
      >
        <currentTheme.icon size={20} className="text-gray-600 dark:text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-2xl overflow-hidden z-50"
            style={{ background: dropdownBg, border: `1px solid ${borderColor}` }}
          >
            <div className="py-1">
              {themes.map((t) => {
                const Icon = t.icon;
                const active = theme === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => handleThemeChange(t.value)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                    style={{
                      color:      active ? textActive  : textDefault,
                      background: active ? bgActive    : "transparent",
                      fontWeight: active ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = bgHover; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <Icon size={16} />
                    {t.label}
                    {active && <div className="ml-auto w-2 h-2 rounded-full" style={{ background: textActive }} />}
                  </button>
                );
              })}
            </div>

            <div className="px-4 pt-3 pb-3" style={{ borderTop: `1px solid ${borderColor}` }}>
              <p
                className="text-[11px] font-semibold uppercase tracking-wide mb-2"
                style={{ color: textDefault }}
              >
                Accent color
              </p>
              <div className="flex items-center gap-2.5">
                {ACCENTS.map((a) => {
                  const active = accent === a.value;
                  return (
                    <button
                      key={a.value}
                      onClick={() => setAccent(a.value)}
                      title={a.label}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{
                        background: a.swatch,
                        boxShadow: active ? `0 0 0 2px ${dropdownBg}, 0 0 0 4px ${a.swatch}` : "none",
                      }}
                    >
                      {active && <Check size={12} className="text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
