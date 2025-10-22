import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  css: {
    devSourcemap: true,
  },
  server: {
    host: '0.0.0.0', // Permite conexiones desde cualquier IP
    port: 5173, // Puerto por defecto de Vite
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: [
      'rh.mondragonmexico.edu.mx',
      'localhost',
      '127.0.0.1',
      '172.18.0.99'
    ]
  },
})
