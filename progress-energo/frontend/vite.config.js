import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Во время разработки запросы /api уходят на Python-бэкенд (порт 8010)
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, proxy: { '/api': 'http://127.0.0.1:8010' } },
})
