import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gianqr_token');
    if (token) {
      api.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(() => localStorage.removeItem('gianqr_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    // Si el server pide 2FA, NO seteamos el user todavia: devolvemos el
    // partial_token al caller para que muestre la pantalla del codigo.
    if (res.data.needs_2fa) {
      return { needs_2fa: true, partial_token: res.data.partial_token };
    }
    localStorage.setItem('gianqr_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  // Segundo paso del login si el user tiene 2FA. Recibe el partial_token
  // emitido por /auth/login + el codigo TOTP (o recovery). Devuelve el
  // user final si valida.
  const verifyTwoFactor = async (partial_token, code) => {
    const res = await api.post('/auth/2fa/verify', { partial_token, code });
    localStorage.setItem('gianqr_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('gianqr_token');
    setUser(null);
  };

  // Re-fetch del user actual desde /auth/me. Util tras cambiar la password
  // (must_change_password pasa de 1 a 0) sin tener que recargar la pagina.
  const refreshUser = async () => {
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
      return r.data;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, verifyTwoFactor }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
