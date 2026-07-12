'use server';

import type { PlanId } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface RedirectState {
  url?: string;
  error?: string;
}

function toMessage(err: ApiError): string {
  if (err.statusCode === 503) return 'Los pagos no están configurados en este entorno todavía.';
  if (err.statusCode === 400) return 'Aún no tienes una suscripción para gestionar.';
  if (err.statusCode === 401) return 'Inicia sesión para continuar.';
  return `No se pudo completar (${err.statusCode ?? 'error'}).`;
}

/** Crea una Checkout Session de Stripe y devuelve la URL para redirigir. */
export async function createCheckoutAction(planId: PlanId): Promise<RedirectState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Inicia sesión para continuar.' };
  try {
    const res = await apiFetch<{ url: string }>('/billing/checkout', {
      method: 'POST',
      accessToken: access,
      body: JSON.stringify({ planId }),
    });
    return { url: res.url };
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}

/** Crea una sesión del Customer Portal (gestionar/cancelar/cambiar de plan). */
export async function createPortalAction(): Promise<RedirectState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Inicia sesión para continuar.' };
  try {
    const res = await apiFetch<{ url: string }>('/billing/portal', {
      method: 'POST',
      accessToken: access,
    });
    return { url: res.url };
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}
