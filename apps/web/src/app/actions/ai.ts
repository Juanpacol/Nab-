'use server';

import type { GeneratedResume, CoverLetterTone } from '@nab/shared';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface AtsResult {
  score: number;
  matched: string[];
  missing: string[];
}

export interface GenerateResumeState {
  resume?: { id: string; title: string; contentJson: GeneratedResume; atsScore: number | null };
  ats?: AtsResult;
  creditsRemaining?: number;
  error?: string;
}

export interface GenerateCoverLetterState {
  coverLetter?: { id: string; content: string; tone: string };
  creditsRemaining?: number;
  error?: string;
}

/** Traduce errores de la API a mensajes en español (402 = sin créditos). */
function toMessage(err: ApiError): string {
  if (err.statusCode === 402) return 'Te has quedado sin créditos. Mejora tu plan para seguir generando.';
  if (err.statusCode === 400) return 'Completa tu perfil antes de generar con IA.';
  if (err.statusCode === 401) return 'Inicia sesión para generar documentos.';
  return `No se pudo generar (${err.statusCode ?? 'error'}).`;
}

export async function generateResumeAction(jobId: string): Promise<GenerateResumeState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Inicia sesión para generar documentos.' };
  try {
    return await apiFetch<GenerateResumeState>('/ai/resumes', {
      method: 'POST',
      accessToken: access,
      body: JSON.stringify({ jobId }),
    });
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}

export async function generateCoverLetterAction(
  jobId: string,
  tone: CoverLetterTone,
): Promise<GenerateCoverLetterState> {
  const access = await getAccessToken();
  if (!access) return { error: 'Inicia sesión para generar documentos.' };
  try {
    return await apiFetch<GenerateCoverLetterState>('/ai/cover-letters', {
      method: 'POST',
      accessToken: access,
      body: JSON.stringify({ jobId, tone }),
    });
  } catch (err) {
    return { error: toMessage(err as ApiError) };
  }
}
