import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../stores/theme-store";

export function ThemeToggle(): JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      role="switch"
      aria-checked={isDark}
      className="relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] hover:bg-[rgba(14,14,14,0.04)] dark:hover:bg-[rgba(244,237,216,0.05)] transition"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
          isDark ? "bg-yellow" : "bg-cream-2 border border-line-2"
        }`}
      >
        <span
          className={`absolute top-[2px] inline-flex h-[16px] w-[16px] items-center justify-center rounded-full bg-paper text-ink-2 shadow-sm transition-transform ${
            isDark ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        >
          {isDark ? <Moon size={9} /> : <Sun size={9} />}
        </span>
      </span>
      <span className="text-[12.5px] text-ink-2">
        {isDark ? "Dark mode" : "Light mode"}
      </span>
    </button>
  );
}
