// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Served from the domain root for Tauri/Docker/PWA (default), but the GitHub
  // Pages demo lives under a subpath — set NEOMA_BASE=/neoma/app/ there so all
  // asset URLs and the service-worker scope resolve correctly.
  base: process.env.NEOMA_BASE || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Neoma',
        short_name: 'Neoma',
        description:
          'A lightweight, open-source research journal and linked-note application. Your knowledge, rooted locally.',
        theme_color: '#141817',
        background_color: '#101413',
        display: 'standalone',
        // Match the deploy base so the installed PWA scopes correctly (root for
        // Tauri/Docker, /neoma/app/ for the GitHub Pages demo).
        start_url: process.env.NEOMA_BASE || '/',
        scope: process.env.NEOMA_BASE || '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/language',
            '@codemirror/commands',
            '@codemirror/search',
            '@codemirror/autocomplete',
            '@codemirror/lang-markdown',
          ],
          markdown: [
            'unified',
            'remark-parse',
            'remark-gfm',
            'remark-math',
            'remark-rehype',
            'rehype-slug',
            'rehype-stringify',
          ],
        },
      },
    },
  },
  // Tauri expects a fixed dev-server URL. On a physical iOS/Android device the
  // server must bind to the LAN address (TAURI_DEV_HOST) so the phone can reach
  // it; on desktop/simulator it stays on localhost. strictPort makes a port
  // clash fail loudly instead of silently drifting off 5173.
  server: {
    host: process.env.TAURI_DEV_HOST || false,
    port: 5173,
    strictPort: true,
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 5183 }
      : undefined,
  },
})
