import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#172B29", 900: "#0F1D1C", 700: "#22403D", 500: "#3A5C58" },
        ivory: { DEFAULT: "#F4F0E8", 200: "#EAE4D8" },
        brass: { DEFAULT: "#C5A36B", 700: "#8F7240" },
        grey: { industrial: "#E7E9E6" },
        charcoal: "#252B29",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      maxWidth: { page: "80rem" },
      letterSpacing: { eyebrow: "0.18em" },
    },
  },
  plugins: [],
};
export default config;
