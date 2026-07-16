'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createCompanySchema, updateCompanySchema } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { setNabMode, type NabMode } from '@/lib/company-mode';

export interface CompanyFormState {
  error?: string;
  ok?: boolean;
}

function messageFromError(err: unknown, fallback: string): string {
  const apiErr = err as ApiError;
  const body = apiErr?.error as { error?: string; message?: string } | string | undefined;
  if (typeof body === 'string') return body || fallback;
  if (body?.error && typeof body.error === 'string') return body.error;
  if (body?.message) return body.message;
  return fallback;
}

/** Da de alta la empresa; el usuario queda como OWNER y el modo cambia a "company". */
export async function createCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada, inicia sesión de nuevo' };

  const parsed = createCompanySchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    website: formData.get('website') || undefined,
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await apiFetch('/companies', {
      method: 'POST',
      accessToken: access,
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo crear la empresa') };
  }

  await setNabMode('company');
  redirect('/empresa');
}

/** Actualiza los datos de la empresa. `companyId` se ata con `.bind(null, companyId)` en el form. */
export async function updateCompanyAction(
  companyId: string,
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada, inicia sesión de nuevo' };

  const parsed = updateCompanySchema.safeParse({
    name: formData.get('name') || undefined,
    website: formData.get('website') || undefined,
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await apiFetch(`/companies/${companyId}`, {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo guardar la empresa') };
  }

  revalidatePath('/empresa/configuracion');
  return { ok: true };
}

/** Cambia el modo candidato↔empresa (cookie de preferencia) y navega al home correspondiente. */
export async function switchModeAction(mode: NabMode): Promise<void> {
  await setNabMode(mode);
  redirect(mode === 'company' ? '/empresa' : '/dashboard');
}
