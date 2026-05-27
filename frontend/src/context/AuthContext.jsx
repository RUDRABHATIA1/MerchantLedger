import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pl_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('pl_token'));

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('pl_token', data.token);
    localStorage.setItem('pl_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('pl_token');
    localStorage.removeItem('pl_user');
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin  = user?.role === 'ADMIN';
  const isTeller = user?.role === 'TELLER' || isAdmin;
  const isAuditor = user?.role === 'AUDITOR' || isAdmin;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isTeller, isAuditor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
