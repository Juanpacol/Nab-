'use server';

import { sendThreadMessageSchema } from '@nab/shared';
import { type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import {
  markThreadReadAsCandidate,
  markThreadReadAsCompany,
  sendMessageAsCandidate as sendMessageAsCandidateFetch,
  sendMessageAsCompany as sendMessageAsCompanyFetch,
  type ThreadMessage,
} from '@/lib/threads';

function messageFromError(err: unknown, fallback: string): string {
  const apiErr = err as ApiError;
  const body = apiErr?.error as { error?: string; message?: string } | string | undefined;
  if (typeof body === 'string') return body || fallback;
  if (body?.error && typeof body.error === 'string') return body.error;
  if (body?.message) return body.message;
  return fallback;
}

export async function sendCandidateMessageAction(
  applicationId: string,
  content: string,
): Promise<{ data?: ThreadMessage; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  const parsed = sendThreadMessageSchema.safeParse({ content });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Mensaje inválido' };

  try {
    const data = await sendMessageAsCandidateFetch(applicationId, parsed.data.content, access);
    return { data };
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo enviar el mensaje') };
  }
}

export async function markCandidateThreadReadAction(applicationId: string): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    await markThreadReadAsCandidate(applicationId, access);
    return {};
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo marcar como leído') };
  }
}

export async function sendCompanyMessageAction(
  companyId: string,
  threadId: string,
  content: string,
): Promise<{ data?: ThreadMessage; error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  const parsed = sendThreadMessageSchema.safeParse({ content });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Mensaje inválido' };

  try {
    const data = await sendMessageAsCompanyFetch(companyId, threadId, parsed.data.content, access);
    return { data };
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo enviar el mensaje') };
  }
}

export async function markCompanyThreadReadAction(companyId: string, threadId: string): Promise<{ error?: string }> {
  const access = await getAccessToken();
  if (!access) return { error: 'Sesión expirada.' };
  try {
    await markThreadReadAsCompany(companyId, threadId, access);
    return {};
  } catch (err) {
    return { error: messageFromError(err, 'No se pudo marcar como leído') };
  }
}
