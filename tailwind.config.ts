import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f0f12",
          raised: "#18181f",
          border: "#2a2a35",
        },
        accent: {
          DEFAULT: "#c9a227",
          muted: "#8a7420",
        },
      },
    },
  },
  plugins: [],
};

export default config;
