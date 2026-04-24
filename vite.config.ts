import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // We already ship a hand-crafted manifest.json in public/. Tell the
      // plugin to take it as-is instead of generating a second one.
      manifest: false,
      includeAssets: ["favicon.ico", "manifest.json", "placeholder.svg", "robots.txt"],
      workbox: {
        // Cache API GETs (dashboard summary, portal reads) for ~5 min so the
        // Today / Portal pages render instantly offline with last-known data.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/patient/dashboard") ||
              url.pathname.startsWith("/api/portal") ||
              url.pathname.startsWith("/api/notifications"),
            handler: "NetworkFirst",
            options: {
              cacheName: "alshifa-api-v1",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "alshifa-static-v1",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // Skip waiting so updates activate on next reload, not next visit.
        skipWaiting: true,
        clientsClaim: true,
        // Auth / refresh / POSTs must never be cached.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false, // don't bog down HMR in dev
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-tabs',
            '@radix-ui/react-scroll-area',
          ],
          charts: ['recharts'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          socketio: ['socket.io-client'],
          // Isolate heavy libs so main bundle parses faster.
          motion: ['framer-motion'],
          query: ['@tanstack/react-query'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          cmdk: ['cmdk'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
