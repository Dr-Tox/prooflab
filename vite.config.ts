import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  worker: { format: "es" },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "ProofLab — Private Scientific Writing",
        short_name: "ProofLab",
        description: "Private, local scientific proofreading",
        theme_color: "#175CD3",
        background_color: "#f4f6fa",
        display: "standalone",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,wasm,txt}"],
        maximumFileSizeToCacheInBytes: 30000000,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { include: ["src/**/*.test.ts"] },
});
