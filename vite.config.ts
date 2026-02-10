import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev mode, proxy /api/* to the local caching server (port 3001).
// Run `node server/index.js` alongside `npm run dev` for cached API calls.
// If the server isn't running, Vite dev still works — requests will 504
// but you can set VITE_DIRECT_API=true in .env to bypass the proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
