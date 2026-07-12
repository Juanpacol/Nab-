'use server';

import { redirect } from 'next/navigation';
import { registerSchema, loginSchema, type AuthTokens, type AuthUser } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { setSessionCookies, clearSessionCookies, getAccessToken } from '@/lib/session';

export interface AuthState {
  error?: string;
}

function messageFromError(err: unknown, fallback: string): string {
  const apiErr = err as ApiError;
  const body = apiErr?.error as { error?: string; message?: string } | string | undefined;
  if (typeof body === 'string') return body || fallback;
  if (body?.error && typeof body.error === 'string') return body.error;
  if (body?.message) return body.message;
  return fallback;
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name') || undefined,
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    const { tokens } = await apiFetch<{ user: AuthUser; tokens: AuthTokens }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    await setSessionCookies(tokens);
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo crear la cuenta') };
  }
  redirect('/onboarding');
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    const { tokens } = await apiFetch<{ user: AuthUser; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    await setSessionCookies(tokens);
  } catch (err) {
    return { error: messageFromError(err, 'Correo o contraseña incorrectos') };
  }
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const access = await getAccessToken();
  // Intento de revocar en el backend es opcional; limpiamos cookies igualmente.
  void access;
  await clearSessionCookies();
  redirect('/login');
}
