import { apiFetch } from './api';

export interface ThreadMessage {
  id: string;
  senderUserId: string;
  fromCompany: boolean;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  applicationId: string;
  createdAt: string;
}

export interface ThreadListItem {
  id: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidate: { id: string; name: string; email: string; avatarUrl: string | null };
  lastMessage: ThreadMessage | null;
  unreadCount: number;
}

// ---------- Lado candidato ----------

export async function getThreadForApplication(applicationId: string, accessToken: string): Promise<Thread> {
  return apiFetch<Thread>(`/applications/${applicationId}/thread`, { accessToken });
}

export async function listMessagesForApplication(
  applicationId: string,
  accessToken: string,
): Promise<ThreadMessage[]> {
  return apiFetch<ThreadMessage[]>(`/applications/${applicationId}/thread/messages`, { accessToken });
}

export async function sendMessageAsCandidate(
  applicationId: string,
  content: string,
  accessToken: string,
): Promise<ThreadMessage> {
  return apiFetch<ThreadMessage>(`/applications/${applicationId}/thread/messages`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ content }),
  });
}

export async function markThreadReadAsCandidate(applicationId: string, accessToken: string): Promise<void> {
  await apiFetch(`/applications/${applicationId}/thread/read`, { method: 'POST', accessToken });
}

export async function getCandidateUnreadCount(accessToken: string): Promise<number> {
  const { count } = await apiFetch<{ count: number }>('/threads/unread-count', { accessToken });
  return count;
}

// ---------- Lado empresa ----------

export async function listThreadsForCompany(
  companyId: string,
  accessToken: string,
  jobId?: string,
): Promise<ThreadListItem[]> {
  const qs = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  return apiFetch<ThreadListItem[]>(`/companies/${companyId}/threads${qs}`, { accessToken });
}

export async function listMessagesForCompanyThread(
  companyId: string,
  threadId: string,
  accessToken: string,
): Promise<ThreadMessage[]> {
  return apiFetch<ThreadMessage[]>(`/companies/${companyId}/threads/${threadId}/messages`, { accessToken });
}

export async function sendMessageAsCompany(
  companyId: string,
  threadId: string,
  content: string,
  accessToken: string,
): Promise<ThreadMessage> {
  return apiFetch<ThreadMessage>(`/companies/${companyId}/threads/${threadId}/messages`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ content }),
  });
}

export async function markThreadReadAsCompany(companyId: string, threadId: string, accessToken: string): Promise<void> {
  await apiFetch(`/companies/${companyId}/threads/${threadId}/read`, { method: 'POST', accessToken });
}

export async function getCompanyUnreadCount(companyId: string, accessToken: string): Promise<number> {
  const { count } = await apiFetch<{ count: number }>(`/companies/${companyId}/threads/unread-count`, { accessToken });
  return count;
}
