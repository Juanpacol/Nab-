import 'server-only';
import { cookies } from 'next/headers';
import type { AuthUser, AuthTokens } from '@nab/shared';
import { apiFetch } from './api';

export const ACCESS_COOKIE = 'nab_access';
export const REFRESH_COOKIE = 'nab_refresh';

const isProd = process.env.NODE_ENV === 'production';

/** Guarda los tokens en cookies httpOnly. */
export async function setSessionCookies(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
  store.set(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: 60 * 15 });
  store.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/** Lee el usuario autenticado (o null). Intenta refrescar si el access expiró. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;

  if (access) {
    try {
      return await apiFetch<AuthUser>('/auth/me', { accessToken: access });
    } catch {
      // access inválido/expirado → intentamos refrescar abajo
    }
  }

  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  try {
    const { tokens } = await apiFetch<{ tokens: AuthTokens }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    });
    await setSessionCookies(tokens);
    return await apiFetch<AuthUser>('/auth/me', { accessToken: tokens.accessToken });
  } catch {
    return null;
  }
}

/** Devuelve el access token actual (para llamadas autenticadas server-side). */
export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}
