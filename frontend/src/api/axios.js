import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
