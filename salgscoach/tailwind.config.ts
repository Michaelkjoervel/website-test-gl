import type { Config } from "tailwindcss";

/**
 * Designsystem · green light Salgscoach
 * -----------------------------------------------------------------------------
 * Lyst og indbydende — samme visuelle identitet som green lights estimatværktøj:
 * hvide flader, varm grønlig baggrund og green lights grønne som accent.
 *
 * Farve betyder stadig noget og bruges aldrig dekorativt:
 *   brand   – green light / Salgsdirektøren (coach)
 *   client  – rollespilskunden (så man aldrig er i tvivl om hvem der taler)
 *   warn    – opmærksomhed, antagelser, risiko
 *   danger  – hårde advarsler, fejl
 *
 * Skalaerne er monotone (50 lysest → 950 mørkest). Flader bruger 50-200,
 * tekst på flader bruger 600-900 — så kontrasten altid holder på lys bund.
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
          DEFAULT: "#4C8FF5",
          50: "#EEF5FF",
          100: "#DCEAFE",
          200: "#BFDAFC",
          300: "#93BEF7",
          400: "#6AA4F2",
          500: "#4C8FF5",
          600: "#3573D6",
          700: "#2A5CAD",
          800: "#1F4483",
          900: "#16305C",
        },
        warn: {
          DEFAULT: "#C9902F",
          50: "#FBF4E3",
          100: "#F6E8C6",
          200: "#EFD79E",
          300: "#E3BE69",
          400: "#D6A643",
          500: "#C9902F",
          600: "#A97523",
          700: "#855C1C",
          800: "#644515",
          900: "#45300F",
        },
        danger: {
          DEFAULT: "#D6444D",
          50: "#FCEDEE",
          100: "#F8D9DB",
          200: "#F2B9BD",
          300: "#E98F96",
          400: "#E0656F",
          500: "#D6444D",
          600: "#B93540",
          700: "#942A33",
          800: "#6F2027",
          900: "#4A151A",
        },
        ink: {
          DEFAULT: "#17210F",
          soft: "#3D4A33",
          mute: "#6B7466",
          faint: "#9AA292",
        },
        base: {
          DEFAULT: "#F5F8EF",
          raise: "#FAFCF6",
          panel: "#FFFFFF",
          panel2: "#EFF3E7",
          line: "#E2E8D8",
          line2: "#C9D3BB",
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
        panel: "0 1px 2px rgba(23,33,15,0.04), 0 8px 24px rgba(23,33,15,0.06)",
        lift: "0 16px 40px rgba(23,33,15,0.14)",
        glow: "0 0 0 1px rgba(159,195,74,0.5), 0 0 28px rgba(159,195,74,0.35)",
        glowClient: "0 0 0 1px rgba(76,143,245,0.4), 0 0 28px rgba(76,143,245,0.25)",
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
