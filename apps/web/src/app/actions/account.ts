'use server';

import { changePasswordSchema } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface AccountState {
  error?: string;
  ok?: boolean;
}

export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada' };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await apiFetch('/users/me/password', {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    const apiErr = err as ApiError;
    const body = apiErr.error as { error?: string } | undefined;
    return {
      error:
        typeof body?.error === 'string'
          ? body.error
          : 'No se pudo cambiar la contraseña. Verifica tu contraseña actual.',
    };
  }
  return { ok: true };
}
