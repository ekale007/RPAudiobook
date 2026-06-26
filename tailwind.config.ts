import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#0c0c0f",
          raised: "#141419",
          border: "#252530",
        },
        accent: {
          DEFAULT: "#c9a227",
          muted: "#8a7420",
        },
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
