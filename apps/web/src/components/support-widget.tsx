'use client';

import { useState } from 'react';
import { Button } from '@nab/ui';
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
            <Button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted hover:text-foreground"
            >
              ✕
            </Button>
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
      <Button
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir soporte"
        variant="primary"
        size="icon"
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full text-2xl shadow-lifted md:bottom-6"
      >
        {open ? '✕' : '💬'}
      </Button>
    </>
  );
}
