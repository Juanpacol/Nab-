'use client';

import { useRef, useState } from 'react';
import { Button } from '@nab/ui';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Panel de chat reutilizable (Fase 5) para el career coach y el widget de
 * soporte. Consume el SSE de /api/chat: burbujas con streaming token a token,
 * indicador de escritura, sugerencias y memoria de sesión.
 */
export function ChatPanel({
  contextType,
  greeting,
  suggestions = [],
  compact = false,
}: {
  contextType: 'SUPPORT' | 'CAREER_COACH';
  greeting: string;
  suggestions?: string[];
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greeting }]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionId = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollDown() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    setInput('');
    setStreaming(true);
    setMessages((m) => [...m, { role: 'user', content }, { role: 'assistant', content: '' }]);
    scrollDown();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextType, content, sessionId: sessionId.current }),
      });
      if (!res.ok || !res.body) throw new Error('stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const line = block.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const evt = JSON.parse(line.slice(6));
          if (evt.delta) {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last) next[next.length - 1] = { role: 'assistant', content: last.content + evt.delta };
              return next;
            });
            scrollDown();
          }
          if (evt.done) sessionId.current = evt.sessionId;
          if (evt.error) {
            setMessages((m) => {
              const next = [...m];
              if (next.length) next[next.length - 1] = { role: 'assistant', content: evt.error };
              return next;
            });
          }
        }
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: 'assistant', content: 'No se pudo conectar con el chat.' };
        return next;
      });
    } finally {
      setStreaming(false);
      scrollDown();
    }
  }

  const lastAssistantEmpty =
    streaming && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-fg'
                  : 'max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm bg-surface-2 px-4 py-2 text-sm text-foreground'
              }
            >
              {m.content || (i === messages.length - 1 && lastAssistantEmpty ? '' : m.content)}
              {i === messages.length - 1 && lastAssistantEmpty && (
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={compact ? 'Escribe tu duda…' : 'Escribe un mensaje…'}
          aria-label="Mensaje"
          className="h-10 flex-1 rounded-sm border border-border bg-bg px-3 text-sm text-foreground outline-none focus:border-primary"
        />
        <Button type="submit" size="sm" disabled={streaming || !input.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
