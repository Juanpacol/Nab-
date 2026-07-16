'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

function toMessage(err: ApiError): string {
  if (err.statusCode === 409) return 'No se pudo guardar: la prueba ya no acepta cambios.';
  if (err.statusCode === 401) return 'Sesión expirada, inicia sesión de nuevo.';
  return `No se pudo completar (${err.statusCode ?? 'error'}).`;
}

/** Idempotente — se llama al montar el runner, no reinicia el cronómetro si ya había empezado. */
export async function startTestAction(applicationId: string): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    await apiFetch(`/applications/${applicationId}/test/start`, { method: 'POST', accessToken: access });
    return {};
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}

/** Autosave — se llama con debounce desde el runner, sin bloquear la UI. */
export async function saveTestAnswersAction(
  applicationId: string,
  answers: { questionId: string; answer: string }[],
): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    await apiFetch(`/applications/${applicationId}/test/answers`, {
      method: 'PUT',
      accessToken: access,
      body: JSON.stringify({ answers }),
    });
    return {};
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}

export async function submitTestAction(applicationId: string): Promise<{ status?: string; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    const result = await apiFetch<{ id: string; status: string }>(`/applications/${applicationId}/test/submit`, {
      method: 'POST',
      accessToken: access,
    });
    revalidatePath(`/applications/${applicationId}`);
    return { status: result.status };
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}
