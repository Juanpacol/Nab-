'use server';

import { revalidatePath } from 'next/cache';
import { autoApplySettingsSchema } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface AutoApplyState {
  error?: string;
  ok?: boolean;
}

/** Guarda la configuración del agente de auto-aplicación (PATCH parcial, no toca el resto del perfil). */
export async function saveAutoApplySettingsAction(
  _prev: AutoApplyState,
  formData: FormData,
): Promise<AutoApplyState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada, inicia sesión de nuevo' };

  const parsed = autoApplySettingsSchema.safeParse({
    autoApplyEnabled: formData.get('autoApplyEnabled') === 'on',
    autoApplyMinScore: Number(formData.get('autoApplyMinScore')),
    autoApplyMaxPerDay: Number(formData.get('autoApplyMaxPerDay')),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await apiFetch('/users/me/auto-apply', {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    const apiErr = err as ApiError;
    const body = apiErr.error as { error?: string } | undefined;
    return {
      error: typeof body?.error === 'string' ? body.error : 'No se pudo guardar la configuración.',
    };
  }

  revalidatePath('/settings');
  return { ok: true };
}
