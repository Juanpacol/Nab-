'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createCompanyJobSchema, updateCompanyJobSchema } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken, getCurrentUser } from '@/lib/session';

export interface CompanyJobFormState {
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

async function requireCompanyContext(): Promise<{ companyId: string; accessToken: string } | { error: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada, inicia sesión de nuevo' };
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) return { error: 'No perteneces a ninguna empresa' };
  return { companyId: user.recruiterCompany.id, accessToken: access };
}

export async function createCompanyJobAction(
  _prev: CompanyJobFormState,
  formData: FormData,
): Promise<CompanyJobFormState> {
  const ctx = await requireCompanyContext();
  if ('error' in ctx) return { error: ctx.error };

  const parsed = createCompanyJobSchema.safeParse({
    title: formData.get('title'),
    location: formData.get('location') || undefined,
    remote: formData.get('remote') === 'on',
    description: formData.get('description'),
    salaryMin: formData.get('salaryMin') ? Number(formData.get('salaryMin')) : undefined,
    salaryMax: formData.get('salaryMax') ? Number(formData.get('salaryMax')) : undefined,
    currency: formData.get('currency') || 'USD',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  let jobId: string;
  try {
    const job = await apiFetch<{ id: string }>(`/companies/${ctx.companyId}/jobs`, {
      method: 'POST',
      accessToken: ctx.accessToken,
      body: JSON.stringify(parsed.data),
    });
    jobId = job.id;
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo publicar la vacante') };
  }

  revalidatePath('/empresa/vacantes');
  redirect(`/empresa/vacantes/${jobId}`);
}

/** `companyId` y `jobId` se atan con `.bind(null, companyId, jobId)` en el form. */
export async function updateCompanyJobAction(
  companyId: string,
  jobId: string,
  _prev: CompanyJobFormState,
  formData: FormData,
): Promise<CompanyJobFormState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada, inicia sesión de nuevo' };

  const parsed = updateCompanyJobSchema.safeParse({
    title: formData.get('title') || undefined,
    location: formData.get('location') || undefined,
    remote: formData.get('remote') === 'on',
    description: formData.get('description') || undefined,
    salaryMin: formData.get('salaryMin') ? Number(formData.get('salaryMin')) : undefined,
    salaryMax: formData.get('salaryMax') ? Number(formData.get('salaryMax')) : undefined,
    currency: formData.get('currency') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await apiFetch(`/companies/${companyId}/jobs/${jobId}`, {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo guardar la vacante') };
  }

  revalidatePath('/empresa/vacantes');
  revalidatePath(`/empresa/vacantes/${jobId}`);
  redirect(`/empresa/vacantes/${jobId}`);
}

/** Cierra/reabre una vacante (isActive). Se invoca directamente desde un botón cliente, sin <form>. */
export async function toggleCompanyJobActiveAction(
  companyId: string,
  jobId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    await apiFetch(`/companies/${companyId}/jobs/${jobId}`, {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify({ isActive }),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo actualizar la vacante') };
  }
  revalidatePath('/empresa/vacantes');
  revalidatePath(`/empresa/vacantes/${jobId}`);
  return {};
}
