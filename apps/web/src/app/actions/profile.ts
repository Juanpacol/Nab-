'use server';

import { revalidatePath } from 'next/cache';
import { profileSchema } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface ProfileState {
  error?: string;
  ok?: boolean;
}

/** Guarda el perfil profesional. Convierte los campos de texto a la forma del schema. */
export async function saveProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada, inicia sesión de nuevo' };

  const toList = (v: FormDataEntryValue | null) =>
    String(v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const parsed = profileSchema.safeParse({
    headline: formData.get('headline') || undefined,
    summary: formData.get('summary') || undefined,
    skills: toList(formData.get('skills')),
    locations: toList(formData.get('locations')),
    desiredRoles: toList(formData.get('desiredRoles')),
    remotePreference: formData.get('remotePreference') || 'ANY',
    experience: [],
    education: [],
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await apiFetch('/users/me/profile', {
      method: 'PUT',
      accessToken: access,
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    const apiErr = err as ApiError;
    return { error: `No se pudo guardar el perfil (${apiErr.statusCode ?? 'error'})` };
  }

  revalidatePath('/profile');
  return { ok: true };
}
