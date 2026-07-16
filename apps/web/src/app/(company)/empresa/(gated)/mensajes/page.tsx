import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar, Badge, EmptyState } from '@nab/ui';
import { getCurrentUser, getAccessToken } from '@/lib/session';
import { listThreadsForCompany } from '@/lib/threads';

export const metadata: Metadata = { title: 'Mensajes · Nab' };

export default async function CompanyMessagesPage() {
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');

  const threads = await listThreadsForCompany(user.recruiterCompany.id, access);

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-3xl">💬</span>}
        title="Aún no hay conversaciones"
        description="Cuando un candidato te escriba sobre una vacante, aparecerá aquí."
      />
    );
  }

  return (
    <div className="max-w-2xl space-y-2">
      <h1 className="mb-4 font-display text-2xl text-foreground">Mensajes</h1>
      {threads.map((t) => (
        <Link
          key={t.id}
          href={`/empresa/mensajes/${t.applicationId}`}
          className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface-2"
        >
          <Avatar src={t.candidate.avatarUrl} name={t.candidate.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{t.candidate.name}</p>
              <span className="text-xs text-muted">· {t.jobTitle}</span>
            </div>
            {t.lastMessage && <p className="truncate text-sm text-muted">{t.lastMessage.content}</p>}
          </div>
          {t.unreadCount > 0 && <Badge variant="danger">{t.unreadCount}</Badge>}
        </Link>
      ))}
    </div>
  );
}
