import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "auto";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "auto",
      isDark: false,
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
    }),
    {
      name: "theme-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

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
