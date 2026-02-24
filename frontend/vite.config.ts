import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forward /auth/* requests to the CF Worker proxy during dev
      '/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
