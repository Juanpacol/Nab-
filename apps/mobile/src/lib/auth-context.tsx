import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser, AuthTokens } from '@nab/shared';
import { apiFetch, type ApiError } from './api';
import { tokenStorage } from './storage';

interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toMessage(err: unknown): string {
  const apiErr = err as ApiError;
  if (apiErr?.statusCode === 401) return 'Correo o contraseña incorrectos.';
  if (apiErr?.statusCode === 409) return 'Ya existe una cuenta con ese correo.';
  return 'Ocurrió un error. Intenta de nuevo.';
}

/** Sesión de la app (Fase 7): bootstrap desde SecureStore + login/registro/logout. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const me = await apiFetch<AuthUser>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      const access = await tokenStorage.getAccess();
      if (access) await refreshUser();
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    try {
      const res = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuthRetry: true,
      });
      await tokenStorage.set(res.tokens.accessToken, res.tokens.refreshToken);
      setUser(res.user);
      return {};
    } catch (err) {
      return { error: toMessage(err) };
    }
  }

  async function register(email: string, password: string, name: string) {
    try {
      const res = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
        skipAuthRetry: true,
      });
      await tokenStorage.set(res.tokens.accessToken, res.tokens.refreshToken);
      setUser(res.user);
      return {};
    } catch (err) {
      return { error: toMessage(err) };
    }
  }

  async function logout() {
    const refreshToken = await tokenStorage.getRefresh();
    if (refreshToken) {
      try {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Si la revocación falla igual limpiamos la sesión local.
      }
    }
    await tokenStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
