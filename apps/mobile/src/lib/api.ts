import type { AuthTokens } from '@nab/shared';
import { tokenStorage } from './storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiError {
  statusCode: number;
  error: unknown;
}

let refreshInFlight: Promise<string | null> | null = null;

/** Rota el refresh token (single-flight: llamadas concurrentes comparten la promesa). */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) return null;
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          await tokenStorage.clear();
          return null;
        }
        const { tokens } = (await res.json()) as { tokens: AuthTokens };
        await tokenStorage.set(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Cliente HTTP hacia la API de Nab (móvil). Adjunta el access token guardado
 * en SecureStore; si expiró (401), rota el refresh token una vez y reintenta.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string; skipAuthRetry?: boolean } = {},
): Promise<T> {
  const { accessToken, skipAuthRetry, headers, ...rest } = options;
  const token = accessToken ?? (await tokenStorage.getAccess());

  const doFetch = async (bearer: string | null) =>
    fetch(`${API_URL}/api${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...headers,
      },
    });

  let res = await doFetch(token);

  if (res.status === 401 && !skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(newToken);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const err: ApiError = { statusCode: res.status, error: body };
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
