import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Sello de version. Sirve para saber de una si el celular esta corriendo la
// version nueva o una cacheada: la app lo muestra en Login y en "Acerca de".
// En Vercel el repo no siempre esta disponible, pero si la env var del commit.
const commit = (() => {
  const deVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (deVercel) return deVercel.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'dev'; }
})();
const fechaBuild = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(`${commit} · ${fechaBuild}`),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' en vez de 'autoUpdate': con autoUpdate la actualizacion se
      // aplicaba sola pero EN SILENCIO, y la pagina abierta seguia corriendo
      // el codigo viejo hasta que alguien recargara. Resultado: pasabamos
      // horas persiguiendo bugs ya arreglados porque el celular seguia con
      // una version cacheada y no habia forma de saberlo.
      // Ahora el componente UpdatePrompt avisa que hay una version nueva y la
      // aplica al tocar un boton.
      registerType: 'prompt',
      // Toma el manifest.json que ya tenemos en /public.
      manifest: false,
      includeAssets: ['favicon.svg', 'manifest.json'],
      workbox: {
        // Cache estatico del shell: HTML/JS/CSS/imagenes generadas por Vite.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        // importScripts injecta nuestro custom SW de Web Push dentro del SW
        // generado por workbox. Asi mantenemos el caching de workbox y
        // sumamos el handler de 'push' / 'notificationclick' en un solo SW.
        importScripts: ['/sw-push.js'],
        // Navegacion SPA: si la ruta no esta cacheada, devuelve index.html
        // (el router de React la resuelve adentro).
        navigateFallback: '/index.html',
        // Skipear navigateFallback para las APIs y para el flujo de auth
        // — no queremos intentar resolver /api/* desde el cache.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          // 1) Pagina del escaner publico (/scan/:token): network-first con
          // fallback a cache. Asi un portero con wifi inestable sigue
          // entrando aunque el server este lento o caido. La VALIDACION
          // del escaneo sigue siendo online (no se valida QRs offline:
          // ver fetch dentro de PublicScanner — esa pega a /api/scan que
          // NO esta cacheado, asi que si no hay red el response es error).
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/scan/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'public-scanner-shell',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          // 2) Assets de Google Fonts (si los usaramos) o CDNs estaticos.
          {
            urlPattern: /^https:\/\/fonts\.(gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // 3) NO cacheamos /api/* en runtime — siempre red para tener data
          // fresca. Si hay error, el cliente muestra error (lo que ya hace).
        ],
      },
      // Devmode opcional: si lo activas, el SW corre en dev tambien (util
      // para testear pero molesto porque cachea localhost). Lo dejamos off.
      devOptions: { enabled: false },
    }),
  ],
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
