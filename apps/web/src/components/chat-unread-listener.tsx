'use client';

import { useEffect } from 'react';
import { useRealtime } from '@/lib/socket';
import { useUnreadStore } from '@/stores/unread';

interface ThreadMessagePayload {
  threadId: string;
  applicationId: string;
  message: { fromCompany: boolean };
}

/**
 * Vive una vez por layout (candidato o empresa) — sincroniza el contador
 * global de no leídos con el valor inicial pedido en el servidor y lo
 * incrementa en vivo cuando llega un mensaje del OTRO lado por un hilo que
 * no está abierto en pantalla ahora mismo (`activeThreadId` en el store, que
 * el panel de chat actualiza al montar/desmontar).
 */
export function ChatUnreadListener({ side, initialCount }: { side: 'candidate' | 'company'; initialCount: number }) {
  const setCount = useUnreadStore((s) => s.setCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount, setCount]);

  useRealtime('thread.message', (payload) => {
    const p = payload as ThreadMessagePayload;
    const isFromOtherSide = side === 'candidate' ? p.message.fromCompany : !p.message.fromCompany;
    if (!isFromOtherSide) return;
    const { activeThreadId, increment } = useUnreadStore.getState();
    if (activeThreadId === p.threadId) return;
    increment();
  });

  return null;
}
