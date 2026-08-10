import type { Config } from "tailwindcss";

/**
 * Designsystem · green light Salgscoach
 * -----------------------------------------------------------------------------
 * Bevidst mørkt og "studie"-agtigt: værktøjet bruges i lange, koncentrerede
 * samtaler, og de visuelle stemme-tilstande (lytter / tænker / taler) skal
 * kunne aflæses på et splitsekund. green lights grønne er accenten — ikke
 * baggrunden — så farve altid betyder noget (hvem taler, hvor står du).
 *
 * Semantiske roller:
 *   brand   – green light / Salgsdirektøren (coach)
 *   client  – rollespilskunden (så man aldrig er i tvivl om hvem der taler)
 *   warn    – opmærksomhed, antagelser, risiko
 *   danger  – hårde advarsler, tabt kvalificering
 */
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
          950: "#1B240C",
        },
        // Rollespilskunden — kølig, "en anden person i rummet".
        client: {
          DEFAULT: "#6FA8FF",
          200: "#C3DAFF",
          300: "#9CC2FF",
          400: "#6FA8FF",
          500: "#4C8FF5",
          600: "#3573D6",
          900: "#122241",
        },
        warn: {
          DEFAULT: "#E8B04B",
          300: "#F3D08C",
          500: "#E8B04B",
          600: "#C9902F",
          900: "#3A2C0E",
        },
        danger: {
          DEFAULT: "#E5646B",
          300: "#F0A0A4",
          500: "#E5646B",
          600: "#C74850",
          900: "#3B1618",
        },
        ink: {
          DEFAULT: "#ECF1E8",
          soft: "#AEB8A9",
          mute: "#76806F",
          faint: "#4C5449",
        },
        base: {
          DEFAULT: "#080B08",
          raise: "#0F130E",
          panel: "#141912",
          panel2: "#1A2018",
          line: "#252C22",
          line2: "#333B2F",
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
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "15px", letterSpacing: "0.05em" }],
      },
      boxShadow: {
        // Ét diskret niveau. Skygger må adskille flader, ikke iscenesætte dem.
        panel: "0 1px 0 rgba(255,255,255,0.025) inset",
        lift: "0 12px 32px rgba(0,0,0,0.45)",
        glow: "0 0 0 1px rgba(159,195,74,0.35), 0 0 32px rgba(159,195,74,0.18)",
        glowClient: "0 0 0 1px rgba(111,168,255,0.35), 0 0 32px rgba(111,168,255,0.18)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
        "3xl": "26px",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.92)", opacity: "0.7" },
          "70%": { transform: "scale(1.25)", opacity: "0" },
          "100%": { transform: "scale(1.25)", opacity: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "bar": {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        "think": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        "sheen": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-up": "fade-up 260ms ease-out both",
        bar: "bar 900ms ease-in-out infinite",
        think: "think 1.4s ease-in-out infinite",
        sheen: "sheen 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
