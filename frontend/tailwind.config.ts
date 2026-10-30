import type { Config } from "tailwindcss";

/**
 * Design tokens. Colours, radii, shadows and motion are defined here once and used everywhere through Tailwind
 * classes (bg-forest, rounded-soft, shadow-lift, ease-out-soft ...), so a change here restyles the whole site.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#172B29", 900: "#0F1D1C", 700: "#22403D", 500: "#3A5C58", 100: "#DDE6E3" },
        ivory: { DEFAULT: "#F4F0E8", 200: "#EAE4D8" },
        paper: "#FBF9F4",   // lightest surface, used for the page background and soft panels
        sand: "#EFEAE0",    // quiet tinted background for grouped content
        brass: { DEFAULT: "#C5A36B", 700: "#8F7240" },
        grey: { industrial: "#E7E9E6" },
        charcoal: "#252B29",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing }]: the typographic scale for headings
        "display": ["clamp(2.75rem, 6.2vw, 5.5rem)", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "title": ["clamp(2rem, 4vw, 3.25rem)", { lineHeight: "1.08", letterSpacing: "-0.028em" }],
        "subtitle": ["clamp(1.375rem, 2.2vw, 1.75rem)", { lineHeight: "1.2", letterSpacing: "-0.018em" }],
      },
      borderRadius: { soft: "0.875rem", card: "1.25rem", panel: "1.75rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(23,43,41,.05), 0 8px 24px -12px rgba(23,43,41,.12)",
        lift: "0 2px 4px rgba(23,43,41,.05), 0 24px 48px -20px rgba(23,43,41,.22)",
      },
      transitionTimingFunction: { "out-soft": "cubic-bezier(.22,.8,.2,1)" },
      maxWidth: { page: "80rem", prose: "40rem" },
      letterSpacing: { eyebrow: "0.18em" },
    },
  },
  plugins: [],
};
export default config;
