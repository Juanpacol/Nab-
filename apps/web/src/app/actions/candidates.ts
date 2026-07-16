'use server';

import { revalidatePath } from 'next/cache';
import { applicationStatusSchema, overrideEvaluationSchema } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { generateAiComparison, type AiComparison } from '@/lib/compare';

function messageFromError(err: unknown, fallback: string): string {
  const apiErr = err as ApiError;
  const body = apiErr?.error as { error?: string; message?: string } | string | undefined;
  if (typeof body === 'string') return body || fallback;
  if (body?.error && typeof body.error === 'string') return body.error;
  if (body?.message) return body.message;
  return fallback;
}

export async function updateApplicantStatusAction(
  companyId: string,
  jobId: string,
  applicationId: string,
  status: string,
): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  const parsed = applicationStatusSchema.safeParse(status);
  if (!parsed.success) return { error: 'Estado inválido' };

  try {
    await apiFetch(`/companies/${companyId}/applications/${applicationId}/status`, {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify({ status: parsed.data }),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo actualizar el estado') };
  }

  revalidatePath(`/empresa/vacantes/${jobId}/candidatos`);
  return {};
}

export async function triggerEvaluationAction(
  companyId: string,
  jobId: string,
  submissionId: string,
): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };

  try {
    await apiFetch(`/companies/${companyId}/submissions/${submissionId}/evaluate`, {
      method: 'POST',
      accessToken: access,
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo iniciar la evaluación') };
  }

  revalidatePath(`/empresa/vacantes/${jobId}/candidatos`);
  return {};
}

export interface OverrideFormState {
  error?: string;
  ok?: boolean;
}

/** `companyId`/`jobId`/`evaluationId` se atan con `.bind(null, ...)` en el form. */
export async function overrideEvaluationAction(
  companyId: string,
  jobId: string,
  applicationId: string,
  evaluationId: string,
  _prev: OverrideFormState,
  formData: FormData,
): Promise<OverrideFormState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };

  const totalScoreRaw = formData.get('totalScore');
  const notesRaw = formData.get('notes');
  const parsed = overrideEvaluationSchema.safeParse({
    totalScore: totalScoreRaw ? Number(totalScoreRaw) : undefined,
    notes: notesRaw ? String(notesRaw) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await apiFetch(`/companies/${companyId}/evaluations/${evaluationId}/override`, {
      method: 'PATCH',
      accessToken: access,
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo guardar el ajuste') };
  }

  revalidatePath(`/empresa/vacantes/${jobId}/candidatos/${applicationId}`);
  return { ok: true };
}

export async function generateAiComparisonAction(
  companyId: string,
  jobId: string,
  applicationIds: string[],
  idempotencyKey: string,
): Promise<{ data?: AiComparison; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };

  try {
    const data = await generateAiComparison(companyId, jobId, applicationIds, idempotencyKey, access);
    return { data };
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo generar el análisis') };
  }
}
