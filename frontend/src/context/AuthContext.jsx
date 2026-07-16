import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  // Memoizamos los handlers con useCallback. Sino, cada render del provider
  // genera funciones nuevas que cambian la identidad del value y
  // re-renderizan todo arbol que use useAuth() (Layout, Sidebar, BottomNav,
  // ProtectedRoute, MoreMenu, Login, etc).
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.needs_2fa) {
      return { needs_2fa: true, partial_token: res.data.partial_token };
    }
    localStorage.setItem('gianqr_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const verifyTwoFactor = useCallback(async (partial_token, code) => {
    const res = await api.post('/auth/2fa/verify', { partial_token, code });
    localStorage.setItem('gianqr_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    // Revocar la sesion en el servidor (fire-and-forget: si falla, el token
    // local igual se borra y la sesion muere en su exp natural). Header
    // explicito: el interceptor lee localStorage en un microtask y para ese
    // momento el token ya fue borrado.
    const token = localStorage.getItem('gianqr_token');
    if (token) {
      api.post('/sessions/logout', null, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('gianqr_token');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
      return r.data;
    } catch {
      return null;
    }
  }, []);

  // useMemo del value: nueva identidad SOLO si cambian user/loading. Las
  // funciones son estables por useCallback. Esto corta el re-render
  // cascada cuando algun hijo cambia sin que cambie la sesion.
  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, verifyTwoFactor }),
    [user, loading, login, logout, refreshUser, verifyTwoFactor]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
