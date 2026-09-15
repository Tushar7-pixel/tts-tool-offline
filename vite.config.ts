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
        description: 'Private, offline PDF reader with realistic multi-accent neural voices (male & female). Turn any document into an audiobook on-device.',
        categories: ['books', 'productivity', 'utilities'],
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'pdf_file',
                accept: ['application/pdf', '.pdf'],
              },
            ],
          },
        },
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
          {src: './mobile-landscape-view(1600x641).png', sizes: '1600x641', type: 'image/png', form_factor: 'wide', label: 'Mobile Landscape View'},
          {src: './mobile-portrait-view(726x1456).png', sizes: '726x1456', type: 'image/png', form_factor: 'narrow', label: 'Mobile Portrait View'},
          {src: './mobile-portrait-view(726x1467).png', sizes: '726x1467', type: 'image/png', form_factor: 'narrow', label: 'Mobile Portrait View Dark'},
          {src: './dark-mode-2(726x1492).png', sizes: '726x1492', type: 'image/png', form_factor: 'narrow', label: 'Mobile View'},
          {src: './dark-mode(726x1454).png', sizes: '726x1454', type: 'image/png', form_factor: 'narrow', label: 'Mobile View dark'},
          {src: './DesktopView(1600x864).png', sizes: '1630x854', type: 'image/png', form_factor: 'wide', label: 'Desktop View'},
        ]
        
      },
    }),
  ],
});