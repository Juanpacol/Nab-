'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface SaveJobState {
  saved?: boolean;
  error?: string;
}

/** Guarda una vacante (crea una Application en estado SAVED). */
export async function saveJobAction(jobId: string): Promise<SaveJobState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Inicia sesión para guardar vacantes' };

  try {
    await apiFetch(`/jobs/${jobId}/save`, { method: 'POST', accessToken: access });
  } catch (err) {
    const apiErr = err as ApiError;
    return { error: `No se pudo guardar (${apiErr.statusCode ?? 'error'})` };
  }
  revalidatePath('/applications');
  return { saved: true };
}
