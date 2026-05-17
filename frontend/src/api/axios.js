import axios from 'axios';

// VITE_API_URL gana siempre (lo setea Vercel via env). En prod sin esa env,
// fallback al subdominio de Railway. Cuando api.gianqr.com este listo, ponemos
// VITE_API_URL=https://api.gianqr.com/api en Vercel y redeploy.
const baseURL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://backend-production-752b7.up.railway.app/api' : '/api');

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Adjuntar token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gianqr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirigir al login si el token expiró
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 || err.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/eventos')) {
        localStorage.removeItem('gianqr_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
