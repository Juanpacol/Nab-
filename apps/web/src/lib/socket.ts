'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

/**
 * Socket compartido de tiempo real (calcado de apps/mobile/src/lib/socket.ts).
 * El access token vive en una cookie httpOnly (invisible a este JS), así que
 * en vez de leerlo de un storage local como hace mobile, el callback `auth`
 * lo pide a /api/realtime-token en cada intento de conexión — el servidor de
 * Next.js es el único que lee la cookie (ver esa ruta para el porqué).
 */
function ensureSocket(): Socket {
  if (socket) return socket;
  socket = io(`${WS_URL}/realtime`, {
    transports: ['websocket'],
    autoConnect: true,
    auth: (cb) => {
      fetch('/api/realtime-token')
        .then((res) => (res.ok ? res.json() : { token: null }))
        .then(({ token }) => cb({ token }))
        .catch(() => cb({ token: null }));
    },
  });
  return socket;
}

/** Suscribe un handler a un evento de tiempo real mientras el componente esté montado. */
export function useRealtime(event: string, handler: (payload: unknown) => void): void {
  useEffect(() => {
    const s = ensureSocket();
    s.on(event, handler);
    return () => {
      s.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}

/** Desconecta el socket compartido (llamar al cerrar sesión, para no quedar autenticado con un token viejo). */
export function disconnectRealtime(): void {
  socket?.disconnect();
  socket = null;
}
