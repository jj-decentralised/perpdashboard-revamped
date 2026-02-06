import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/llama': {
        target: 'https://api.llama.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llama/, ''),
      },
      '/api/gecko': {
        target: 'https://api.coingecko.com/api/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gecko/, ''),
      },
    },
  },
})
