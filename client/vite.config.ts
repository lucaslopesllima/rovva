import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev: proxy /api to the Fastify server. Prod: Fastify serves the built assets.
// In docker-compose.dev the API service is reachable at http://app:8080 (VITE_PROXY_TARGET).
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on 0.0.0.0 so the container port is reachable
    port: 5173,
    proxy: {
      '/api': { target: proxyTarget, changeOrigin: true },
    },
    watch: {
      // inotify works for bind mounts on native Linux; flip on if HMR misses changes (e.g. on a VM/WSL)
      usePolling: process.env.VITE_USE_POLLING === '1',
    },
  },
  build: { outDir: 'dist' },
});
