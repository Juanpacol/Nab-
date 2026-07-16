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

export async function getThreadForApplication(applicationId: string): Promise<Thread> {
  return apiFetch<Thread>(`/applications/${applicationId}/thread`);
}

export async function listThreadMessages(applicationId: string): Promise<ThreadMessage[]> {
  return apiFetch<ThreadMessage[]>(`/applications/${applicationId}/thread/messages`);
}

export async function sendThreadMessage(applicationId: string, content: string): Promise<ThreadMessage> {
  return apiFetch<ThreadMessage>(`/applications/${applicationId}/thread/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function markThreadRead(applicationId: string): Promise<void> {
  await apiFetch(`/applications/${applicationId}/thread/read`, { method: 'POST' });
}

export async function getUnreadCount(): Promise<number> {
  const { count } = await apiFetch<{ count: number }>('/threads/unread-count');
  return count;
}
