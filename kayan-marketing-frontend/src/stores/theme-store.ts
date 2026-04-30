import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "kayan.theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Fall through to OS preference for first-time visitors.
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyToDocument(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readInitialTheme(),
  setTheme: (theme) => {
    applyToDocument(theme);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggle: () =>
    set((s) => {
      const next: Theme = s.theme === "dark" ? "light" : "dark";
      applyToDocument(next);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
      return { theme: next };
    }),
}));

// Apply once on module load so the class is present before React renders —
// this prevents a one-frame flash of the wrong theme.
applyToDocument(readInitialTheme());
