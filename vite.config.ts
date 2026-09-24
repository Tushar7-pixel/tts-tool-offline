// vite.config.ts
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
        // Precache all local bundles, html, wasm binaries, workers and static images
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,mjs,json}'],
        navigateFallback: '/index.html',

        // Increase maximum precache size so large pdfjs & onnx binaries are allowed
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,

        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        runtimeCaching: [
          // 1. Google Fonts stylesheets & webfonts
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          // 2. Open Library Covers & Metadata (for offline bookshelf viewing)
          {
            urlPattern: ({ url }) =>
              url.origin.includes('covers.openlibrary.org') ||
              url.origin.includes('openlibrary.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'openlibrary-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          // 3. Hugging Face & Cloudflare CDN (Voices & ONNX Runtimes)
          {
            urlPattern: ({ url }) =>
              url.origin.includes('cdnjs.cloudflare.com') ||
              url.origin.includes('huggingface.co'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'piper-onnx-models-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          // 4. Dictionary API cache (offline lookup for previously checked words)
          {
            urlPattern: ({ url }) => url.origin.includes('api.dictionaryapi.dev'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'dictionary-api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'PIPER BOOK READER',
        short_name: 'PIPER READER',
        description:
          'Private, offline PDF reader with realistic multi-accent neural voices (male & female). Turn any document into an audiobook on-device.',
        categories: ['books', 'productivity', 'utilities'],
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        id: '/?source=pwa',
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
        screenshots: [
          {
            src: './mobile-landscape-view(1600x641).jpeg',
            sizes: '1600x641',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Mobile Landscape View',
          },
          {
            src: './mobile-portrait-view(726x1456).jpeg',
            sizes: '726x1456',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Mobile Portrait View',
          },
          {
            src: './mobile-portrait-view(726x1467).jpeg',
            sizes: '726x1467',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Mobile Portrait View Dark',
          },
          {
            src: './dark-mode-2(726x1492).jpeg',
            sizes: '726x1492',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Mobile View',
          },
          {
            src: './dark-mode(726x1454).jpeg',
            sizes: '726x1454',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Mobile View dark',
          },
          {
            src: './DesktopView(1600x864).jpeg',
            sizes: '1600x864',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Desktop View',
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});