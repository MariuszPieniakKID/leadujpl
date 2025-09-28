import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['leady_logo.png'],
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Local/proxied API calls
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24,
              },
              backgroundSync: {
                name: 'api-write-queue',
                options: {
                  maxRetentionTime: 24 * 60, // minutes
                }
              }
            },
          },
          {
            // Railway-hosted backend API (e.g., https://*.railway.app/api/*)
            urlPattern: /https?:\/\/[^/]*\.railway\.app\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache-railway',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24,
              },
              backgroundSync: {
                name: 'railway-write-queue',
                options: {
                  maxRetentionTime: 24 * 60,
                }
              }
            },
          },
        ],
      },
      manifest: {
        name: 'leaduj',
        short_name: 'leaduj',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        background_color: '#0b1220',
        theme_color: '#7c3aed',
        icons: [
          { src: '/leady_logo.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/leady_logo.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 3004,
    strictPort: true,
    hmr: { overlay: false },
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
})
