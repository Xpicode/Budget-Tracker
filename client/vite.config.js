import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Send /api calls to Express, so the browser sees one origin (no CORS needed)
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
