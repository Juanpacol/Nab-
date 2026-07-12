'use client';

import { useState } from 'react';
import { Button, Card } from '@nab/ui';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Prepárame para una entrevista en Stripe',
  'Mejora el resumen de mi CV',
  '¿Por qué no me responden las empresas?',
];

// Fase 5: conectar con /api/chat (streaming SSE + tool-use). UI de andamiaje.
const INITIAL: Msg[] = [
  {
    role: 'assistant',
    content:
      '¡Hola! Soy tu coach de carrera. Puedo ayudarte a preparar entrevistas, mejorar tu CV y entender tu búsqueda. ¿Por dónde empezamos?',
  },
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState('');

  function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      {
        role: 'assistant',
        content: 'Cuando conectemos el motor de IA (Fase 5) responderé aquí con streaming en tiempo real.',
      },
    ]);
    setInput('');
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <h1 className="font-display text-3xl text-foreground">Coach IA</h1>

      <Card className="mt-4 flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] rounded-lg rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-fg'
                    : 'max-w-[80%] rounded-lg rounded-bl-sm bg-surface-2 px-4 py-2 text-sm text-foreground'
                }
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-primary"
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
          className="flex gap-2 border-t border-border p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje…"
            className="h-11 flex-1 rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
          />
          <Button type="submit">Enviar</Button>
        </form>
      </Card>
    </div>
  );
}
