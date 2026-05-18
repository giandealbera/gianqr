import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Split vendor libs en chunks separados — el bundle inicial baja mucho
    // y los chunks de libs quedan cacheados entre deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'qr-vendor':    ['qrcode.react', 'html5-qrcode'],
          'utils-vendor': ['axios', 'react-hot-toast'],
        },
      },
    },
    // Sube el warning limit — los chunks pueden ser 500KB y está bien
    chunkSizeWarningLimit: 600,
  },
});
