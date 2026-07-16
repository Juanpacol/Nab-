'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { generateTechTestSchema, type UpdateTechTestInput } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken, getCurrentUser } from '@/lib/session';

export interface TestGenerationState {
  error?: string;
  testId?: string;
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

/** Inicia la generación (cobra créditos, corre asíncrono). El wizard escucha realtime/polling para saber cuándo terminó. */
export async function createTechTestAction(
  _prev: TestGenerationState,
  formData: FormData,
): Promise<TestGenerationState> {
  const ctx = await requireCompanyContext();
  if ('error' in ctx) return { error: ctx.error };

  const keySkills = String(formData.get('keySkills') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = generateTechTestSchema.safeParse({
    roleTitle: formData.get('roleTitle'),
    spec: formData.get('spec'),
    seniority: formData.get('seniority') || undefined,
    keySkills,
    targetDurationMinutes: formData.get('targetDurationMinutes')
      ? Number(formData.get('targetDurationMinutes'))
      : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    const test = await apiFetch<{ id: string }>(`/companies/${ctx.companyId}/tests`, {
      method: 'POST',
      accessToken: ctx.accessToken,
      body: JSON.stringify(parsed.data),
    });
    return { testId: test.id };
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo iniciar la generación') };
  }
}

export async function regenerateTechTestAction(testId: string): Promise<TestGenerationState> {
  const ctx = await requireCompanyContext();
  if ('error' in ctx) return { error: ctx.error };

  try {
    const test = await apiFetch<{ id: string }>(`/companies/${ctx.companyId}/tests/${testId}/regenerate`, {
      method: 'POST',
      accessToken: ctx.accessToken,
    });
    return { testId: test.id };
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo regenerar la prueba') };
  }
}

export async function updateTechTestAction(
  testId: string,
  input: UpdateTechTestInput,
): Promise<{ error?: string }> {
  const ctx = await requireCompanyContext();
  if ('error' in ctx) return { error: ctx.error };

  try {
    await apiFetch(`/companies/${ctx.companyId}/tests/${testId}`, {
      method: 'PATCH',
      accessToken: ctx.accessToken,
      body: JSON.stringify(input),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo guardar la prueba') };
  }
  revalidatePath(`/empresa/vacantes`);
  return {};
}

/** Adjunta la prueba a la vacante y navega al estado de la prueba de esa vacante. */
export async function attachTechTestAction(jobId: string, testId: string): Promise<{ error?: string }> {
  const ctx = await requireCompanyContext();
  if ('error' in ctx) return { error: ctx.error };

  try {
    await apiFetch(`/companies/${ctx.companyId}/jobs/${jobId}/test`, {
      method: 'PUT',
      accessToken: ctx.accessToken,
      body: JSON.stringify({ techTestId: testId }),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo adjuntar la prueba a la vacante') };
  }
  revalidatePath(`/empresa/vacantes/${jobId}`);
  redirect(`/empresa/vacantes/${jobId}/prueba`);
}

export async function detachTechTestAction(jobId: string): Promise<{ error?: string }> {
  const ctx = await requireCompanyContext();
  if ('error' in ctx) return { error: ctx.error };

  try {
    await apiFetch(`/companies/${ctx.companyId}/jobs/${jobId}/test`, {
      method: 'DELETE',
      accessToken: ctx.accessToken,
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo quitar la prueba') };
  }
  revalidatePath(`/empresa/vacantes/${jobId}`);
  revalidatePath(`/empresa/vacantes/${jobId}/prueba`);
  return {};
}
