import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite Frontend Configuration (vite.config.js)
// Proxies /api/* requests during local development to the Express backend on port 5000.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['html5-qrcode', 'qrcode'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
