import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,mjs}'],
        navigateFallback: '/index.html',
        // Cache external ONNX / Piper CDN resources offline
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin.includes('cdnjs.cloudflare.com') ||
              url.origin.includes('huggingface.co'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'offline-cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'PIPER BOOK READER',        // Full application name
        short_name: 'PIPER READER',      // Short name displayed beneath home screen icon
        description: 'Offline-first neural voice PDF reader',
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});