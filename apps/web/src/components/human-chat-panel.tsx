'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, Button, Textarea } from '@nab/ui';
import { useRealtime } from '@/lib/socket';
import { useUnreadStore } from '@/stores/unread';
import type { ThreadMessage } from '@/lib/threads';

interface ThreadMessagePayload {
  threadId: string;
  applicationId: string;
  message: ThreadMessage;
}

/**
 * Chat humano↔humano compartido por ambos lados (candidato y RH) — envío por
 * REST (server action inyectada por el caller), recepción por socket. NO usa
 * SSE ni streaming: a diferencia de chat-panel.tsx (coach IA, respuesta
 * token a token de un modelo), acá cada mensaje es un turno completo y
 * discreto de una persona real.
 */
export function HumanChatPanel({
  threadId,
  currentUserId,
  otherPartyName,
  otherPartyAvatarUrl,
  initialMessages,
  onSend,
  onMarkRead,
  placeholder = 'Escribe un mensaje…',
}: {
  threadId: string;
  currentUserId: string;
  otherPartyName: string;
  otherPartyAvatarUrl?: string | null;
  initialMessages: ThreadMessage[];
  onSend: (content: string) => Promise<{ data?: ThreadMessage; error?: string }>;
  onMarkRead: () => Promise<{ error?: string }>;
  placeholder?: string;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollDown() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  // Marca este hilo como "abierto" mientras el panel está montado — el
  // listener global de no-leídos no incrementa el badge por mensajes de un
  // hilo que el usuario ya está viendo.
  useEffect(() => {
    useUnreadStore.getState().setActiveThread(threadId);
    const unreadInView = initialMessages.filter((m) => m.senderUserId !== currentUserId && m.readAt === null).length;
    if (unreadInView > 0) {
      onMarkRead().then((res) => {
        if (!res.error) {
          const { count, setCount } = useUnreadStore.getState();
          setCount(count - unreadInView);
        }
      });
    }
    return () => useUnreadStore.getState().setActiveThread(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(scrollDown, [messages.length]);

  useRealtime('thread.message', (payload) => {
    const p = payload as ThreadMessagePayload;
    if (p.threadId !== threadId) return;
    setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
  });

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setError(null);
    setInput('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: ThreadMessage = {
      id: tempId,
      senderUserId: currentUserId,
      fromCompany: false, // se corrige abajo si onSend confirma otro valor
      content,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const res = await onSend(content);
    setSending(false);
    if (res.error) {
      setError(res.error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }
    if (res.data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? res.data! : m)));
    }
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-lg border border-border bg-surface">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            Aún no hay mensajes. Escríbele a {otherPartyName} para empezar la conversación.
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.senderUserId === currentUserId;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
              {!isMine && <Avatar src={otherPartyAvatarUrl} name={otherPartyName} size="sm" />}
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  isMine ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className={`mt-1 text-[10px] ${isMine ? 'text-primary-fg/70' : 'text-muted'}`}>
                  {new Date(m.createdAt).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border p-3">
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder}
            rows={2}
            className="flex-1 resize-none"
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()}>
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
