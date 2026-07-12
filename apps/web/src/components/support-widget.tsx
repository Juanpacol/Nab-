'use client';

import { useState } from 'react';
import { ChatPanel } from '@/components/chat-panel';

/**
 * Widget flotante de soporte (Fase 5): botón que abre un chat con el bot de
 * soporte (RAG sobre artículos de ayuda).
 */
export function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[70vh] max-h-[520px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-bg shadow-lifted md:bottom-20">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-display text-sm text-foreground">Soporte de Nab</p>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-muted hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              contextType="SUPPORT"
              greeting="Hola 👋 Soy el asistente de soporte. Pregúntame sobre créditos, generación de CV, planes…"
              suggestions={['¿Cómo funcionan los créditos?', '¿Cómo genero un CV?']}
              compact
            />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir soporte"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-fg shadow-lifted transition-transform active:scale-90 md:bottom-6"
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
