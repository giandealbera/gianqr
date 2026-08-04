const rawEnv = import.meta.env.VITE_API_URL || '';
const isBrokenEnv = rawEnv.includes('railway') || rawEnv.includes('api.gianqr.com');

export const BACKEND_URL = (rawEnv && !isBrokenEnv)
  ? rawEnv
  : (import.meta.env.PROD ? 'https://gianqr.onrender.com/api' : '/api');
