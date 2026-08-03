import axios from 'axios';

// VITE_API_URL gana siempre (lo setea Vercel via env). En prod sin esa env,
// fallback al backend de Render.
const baseURL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://gianqr.onrender.com/api' : '/api');

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

// Desloguear SOLO cuando el token es inválido/expirado de verdad.
// Antes: cualquier 403 (incluido "Sin acceso a este evento") deslogueaba al
// usuario. Resultado: un owner que abre un evento ajeno por equivocacion era
// expulsado al login. Ahora solo deslogueamos en:
//   - 401 (Token no proporcionado / Sesión revocada / Token inválido o expirado)
//   - 403 con un mensaje conocido de invalidacion ("Token inválido o expirado"
//     / "Sesión revocada"), que es lo que devuelve auth.js cuando el JWT esta
//     mal o el password se cambio.
// 403 con cualquier otro mensaje = falta de permiso sobre un recurso → toast
// del caller, NO deslogueo.
const INVALIDATION_HINTS = ['Token inválido', 'Token no proporcionado', 'Sesión revocada', 'Sesión de verificación'];
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg    = err.response?.data?.error || '';
    const looksLikeAuthInvalidation =
      status === 401 ||
      (status === 403 && INVALIDATION_HINTS.some(h => msg.startsWith(h)));
    if (looksLikeAuthInvalidation) {
      const path = window.location.pathname;
      if (!path.startsWith('/login')) {
        localStorage.removeItem('gianqr_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
