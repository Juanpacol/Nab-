import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, getAccessToken } from '@/lib/session';
import { listThreadsForCompany, listMessagesForCompanyThread } from '@/lib/threads';
import { sendCompanyMessageAction, markCompanyThreadReadAction } from '@/app/actions/threads';
import { HumanChatPanel } from '@/components/human-chat-panel';

export const metadata: Metadata = { title: 'Conversación · Nab' };

export default async function CompanyThreadPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');
  const companyId = user.recruiterCompany.id;

  const threads = await listThreadsForCompany(companyId, access);
  const thread = threads.find((t) => t.applicationId === applicationId);
  if (!thread) notFound();

  const messages = await listMessagesForCompanyThread(companyId, thread.id, access);

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/empresa/mensajes" className="text-sm text-muted hover:text-foreground">
        ← Mensajes
      </Link>
      <div>
        <h1 className="font-display text-xl text-foreground">{thread.candidate.name}</h1>
        <p className="text-sm text-muted">{thread.jobTitle}</p>
      </div>
      <HumanChatPanel
        threadId={thread.id}
        currentUserId={user.id}
        otherPartyName={thread.candidate.name}
        otherPartyAvatarUrl={thread.candidate.avatarUrl}
        initialMessages={messages}
        onSend={sendCompanyMessageAction.bind(null, companyId, thread.id)}
        onMarkRead={markCompanyThreadReadAction.bind(null, companyId, thread.id)}
        placeholder={`Escríbele a ${thread.candidate.name}…`}
      />
    </div>
  );
}
