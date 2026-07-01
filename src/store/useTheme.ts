import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "auto";
export type Accent = "blue" | "violet" | "emerald" | "orange" | "rose";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "blue",    label: "Blue",    swatch: "#3b82f6" },
  { value: "violet",  label: "Violet",  swatch: "#8b5cf6" },
  { value: "emerald", label: "Emerald", swatch: "#10b981" },
  { value: "orange",  label: "Orange",  swatch: "#f97316" },
  { value: "rose",    label: "Rose",    swatch: "#f43f5e" },
];

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "auto",
      isDark: false,
      accent: "blue",
      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(theme);
      },
      setIsDark: (isDark: boolean) => {
        set({ isDark });
        if (get().theme !== "auto") {
          applyTheme(get().theme);
        }
      },
      setAccent: (accent: Accent) => {
        set({ accent });
        applyAccent(accent);
      },
    }),
    {
      name: "theme-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
          applyAccent(state.accent);
        }
      },
    }
  )
);

function applyAccent(accent: Accent) {
  document.documentElement.setAttribute("data-accent", accent);
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  let shouldBeDark = false;

  if (theme === "auto") {
    shouldBeDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } else {
    shouldBeDark = theme === "dark";
  }

  useTheme.setState({ isDark: shouldBeDark });

  if (shouldBeDark) {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

// Listen for system theme changes when in auto mode
if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", (e) => {
    if (useTheme.getState().theme === "auto") {
      applyTheme("auto");
    }
  });
}
