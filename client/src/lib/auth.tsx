import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, getToken } from './api.ts';

export interface User {
  id: number | string;
  email: string;
  role: string;
  org_id: number | string;
  org_nome?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (org_nome: string, email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get<{ user: User }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, senha: string): Promise<void> => {
    const r = await api.post<{ token: string; user: User }>('/api/auth/login', { email, senha });
    setToken(r.token);
    setUser(r.user);
  };

  const register = async (org_nome: string, email: string, senha: string): Promise<void> => {
    const r = await api.post<{ token: string; user: User }>('/api/auth/register', { org_nome, email, senha });
    setToken(r.token);
    setUser(r.user);
  };

  const logout = (): void => {
    setToken(null);
    setUser(null);
    location.href = '/login';
  };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
