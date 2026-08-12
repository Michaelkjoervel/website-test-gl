import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Selvstændig app. Relativ base, så samme build kan ligge under
// https://<user>.github.io/<repo>/salgscoach/ og på et domæne-rod.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5174, host: true },
});
