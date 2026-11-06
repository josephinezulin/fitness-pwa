import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { matchPublicThumbnail } from "./src/cache-policy";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "日常動作｜個人健身日誌",
        short_name: "日常動作",
        lang: "zh-Hant",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#f6f7f2",
        theme_color: "#244c3f",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: matchPublicThumbnail,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "daily-movement-youtube-thumbnails-v1",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 14 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
      },
    }),
  ],
});
