'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { APPLICATION_STATUS_LABELS } from '@nab/shared';
import { useRealtime } from '@/lib/socket';

interface StatusChangedPayload {
  applicationId: string;
  status: string;
  jobTitle?: string;
  company?: string;
}

interface Toast {
  id: string;
  text: string;
}

/**
 * Escucha eventos de tiempo real (cambios de estado de aplicaciones, incluidas
 * las del agente de auto-aplicación) y los muestra como un toast — antes la
 * web no tenía ningún cliente WebSocket, así que estos cambios solo se veían
 * al recargar la página a mano. También refresca las Server Components
 * (dashboard, aplicaciones) con `router.refresh()` para que reflejen el dato
 * nuevo sin que el usuario tenga que hacerlo.
 */
export function RealtimeToaster() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useRealtime('application.status_changed', (payload) => {
    const p = payload as StatusChangedPayload;
    const label = APPLICATION_STATUS_LABELS[p.status] ?? p.status;
    const text = p.jobTitle
      ? `${p.jobTitle}${p.company ? ` en ${p.company}` : ''}: ${label}`
      : `Aplicación actualizada: ${label}`;

    const id = `${p.applicationId}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    router.refresh();
  });

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="rounded-sm border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-lifted"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
