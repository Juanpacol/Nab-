import { getThreadForApplication, listMessagesForApplication } from '@/lib/threads';
import { getAccessToken } from '@/lib/session';
import { sendCandidateMessageAction, markCandidateThreadReadAction } from '@/app/actions/threads';
import { HumanChatPanel } from '@/components/human-chat-panel';

export async function ApplicationChatCard({
  applicationId,
  currentUserId,
  companyName,
}: {
  applicationId: string;
  currentUserId: string;
  companyName: string;
}) {
  const access = await getAccessToken();
  if (!access) return null;

  const thread = await getThreadForApplication(applicationId, access);
  const messages = await listMessagesForApplication(applicationId, access);

  return (
    <HumanChatPanel
      threadId={thread.id}
      currentUserId={currentUserId}
      otherPartyName={companyName}
      initialMessages={messages}
      onSend={sendCandidateMessageAction.bind(null, applicationId)}
      onMarkRead={markCandidateThreadReadAction.bind(null, applicationId)}
      placeholder={`Escríbele a ${companyName}…`}
    />
  );
}
