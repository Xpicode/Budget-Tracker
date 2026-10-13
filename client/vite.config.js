import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' lets the app show an "Update available" toast; 'autoUpdate' would reload silently.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Budget Tracker',
        short_name: 'Budget',
        description: 'Offline-first budget and expense tracker',
        theme_color: '#2563eb',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell (HTML, JS, CSS, icons) so it opens offline.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Never serve the app shell for API calls; those go to the network or fail honestly.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    // Send /api calls to Express, so the browser sees one origin (no CORS needed)
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
