import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/health': {
        target: 'http://127.0.0.1:8091',
        changeOrigin: true,
      },
      '/api/v1/predict/': {
        target: 'http://127.0.0.1:8091',
        changeOrigin: true,
      },
      '/ws/': {
        target: 'ws://127.0.0.1:8091',
        ws: true,
        changeOrigin: true,
      },
      '/weights/': {
        target: 'http://127.0.0.1:8091',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
