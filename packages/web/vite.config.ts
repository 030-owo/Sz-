import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 開發時把 /api 與 /ws 轉發到後端 (預設 :8080)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
