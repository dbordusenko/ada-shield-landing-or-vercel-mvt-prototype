import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0f2444",
        secondary: "#c8a94b",
        accent: "#1a3a6e",
        muted: "#64748b",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;