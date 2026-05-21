import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#9FC34A",
          50: "#F4F8E8",
          100: "#E8F1D1",
          200: "#D2E3A3",
          300: "#BCD575",
          400: "#A6C747",
          500: "#9FC34A",
          600: "#84A538",
          700: "#65802A",
          800: "#4A5E1F",
          900: "#2F3D14",
        },
        ink: {
          DEFAULT: "#0F1A0A",
          soft: "#3D4A33",
          mute: "#6B7466",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          soft: "#F8FAF4",
          line: "#E5EBDD",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,26,10,0.04), 0 8px 24px rgba(15,26,10,0.06)",
        glow: "0 0 0 6px rgba(159,195,74,0.15)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
