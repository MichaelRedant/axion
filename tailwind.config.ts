import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{js,ts,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--ax-bg)",
        neon: "var(--ax-neon)",
        violet: "var(--ax-violet)",
        amber: "var(--ax-amber)",
        grid: "var(--ax-grid)",
      },
      fontFamily: {
        display: ["var(--font-orbitron)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-plex)", ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        neon: "0 0 12px rgba(0, 255, 242, 0.45)",
        violet: "0 0 18px rgba(123, 44, 191, 0.45)",
      },
      keyframes: {
        scanlines: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.2" },
        },
        pulse: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(0, 255, 242, 0.4)" },
          "50%": { boxShadow: "0 0 18px rgba(0, 255, 242, 0.75)" },
        },
      },
      animation: {
        scanlines: "scanlines 6s linear infinite",
        pulse: "pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
