'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface ApplyState {
  applyUrl?: string;
  alreadyApplied?: boolean;
  error?: string;
}

function toMessage(err: ApiError): string {
  if (err.statusCode === 402) return 'Sin créditos. Mejora tu plan para seguir aplicando.';
  if (err.statusCode === 401) return 'Inicia sesión para aplicar.';
  return `No se pudo completar (${err.statusCode ?? 'error'}).`;
}

/** Aplica a una vacante (asistido; descuenta 1 crédito). */
export async function applyAction(jobId: string): Promise<ApplyState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Inicia sesión para aplicar.' };
  try {
    const res = await apiFetch<{ applyUrl: string; alreadyApplied: boolean }>('/applications', {
      method: 'POST',
      accessToken: access,
      body: JSON.stringify({ jobId }),
    });
    revalidatePath('/applications');
    return { applyUrl: res.applyUrl, alreadyApplied: res.alreadyApplied };
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}

export async function updateStatusAction(id: string, status: string): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    await apiFetch(`/applications/${id}/status`, {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify({ status }),
    });
    revalidatePath('/applications');
    return {};
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}

export async function updateNotesAction(id: string, notes: string): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    await apiFetch(`/applications/${id}/notes`, {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify({ notes }),
    });
    revalidatePath(`/applications/${id}`);
    return {};
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}
