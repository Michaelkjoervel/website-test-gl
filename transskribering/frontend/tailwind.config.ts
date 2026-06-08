import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f7ff",
          100: "#e3edff",
          500: "#3056d3",
          600: "#2545b4",
          700: "#1e3a96",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial"],
      },
    },
  },
  plugins: [],
} satisfies Config;
