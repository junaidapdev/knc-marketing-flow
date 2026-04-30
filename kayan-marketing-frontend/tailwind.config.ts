import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surfaces — flip between light/dark via CSS vars defined in index.css.
        cream: {
          DEFAULT: "var(--c-cream)",
          2: "var(--c-cream-2)",
        },
        paper: "var(--c-paper)",
        warmbg: "var(--c-warmbg)",
        outerframe: "#2A2622",

        // Text — flips.
        ink: {
          DEFAULT: "var(--c-ink)",
          2: "var(--c-ink-2)",
          3: "var(--c-ink-3)",
        },

        // Brand tokens — fixed (don't flip; obsidian is always dark, used as
        // a strong button/backdrop surface; yellow is the accent).
        obsidian: "#0E0E0E",
        yellow: {
          DEFAULT: "#FFD23F",
          soft: "var(--c-yellow-soft)",
          bg: "var(--c-yellow-bg)",
        },

        // Pastel category palette — fixed. They read as bright "stickers" on
        // either canvas, so we don't flip them.
        peach: { DEFAULT: "#F8D4C0", deep: "#E89B7A" },
        sage: { DEFAULT: "#C9DFC8", deep: "#6FA572" },
        sky: { DEFAULT: "#C9DCEA", deep: "#6F95B8" },
        lavender: { DEFAULT: "#DDD2E8", deep: "#8B7AB0" },
        butter: "#FFE9A8",
        rose: { DEFAULT: "#F5C7CC", deep: "#C7707A" },

        // Back-compat — anything that still references kayan-* maps to the
        // same brand tokens above.
        kayan: {
          yellow: "#FFD23F",
          black: "#0E0E0E",
          white: "var(--c-cream)",
        },
      },
      fontFamily: {
        // Two-font system:
        //   serif → Space Grotesk (display / headings, the "primary" font).
        //   sans  → DM Sans (body / UI, the "secondary" font).
        // The "serif" alias is preserved (not actually a serif) so every
        // existing `font-serif` heading instantly picks up Space Grotesk
        // without touching component code.
        serif: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["'DM Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(14,14,14,0.04)",
        md: "0 4px 16px rgba(14,14,14,0.06)",
        lg: "0 12px 32px rgba(14,14,14,0.08)",
        fab: "0 12px 28px rgba(14,14,14,0.25)",
      },
      borderColor: {
        line: "var(--c-line)",
        "line-2": "var(--c-line-2)",
      },
    },
  },
  plugins: [],
};

export default config;
