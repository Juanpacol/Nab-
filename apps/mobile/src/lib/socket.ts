import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';
import { tokenStorage } from './storage';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? API_URL;

let socket: Socket | null = null;

/**
 * Socket compartido de tiempo real (Fase 7). Se conecta una sola vez; el
 * token se resuelve en cada intento de conexión (incluidos los reintentos
 * automáticos de socket.io), así que sobrevive a la rotación del access token.
 */
function ensureSocket(): Socket {
  if (socket) return socket;
  socket = io(`${WS_URL}/realtime`, {
    transports: ['websocket'],
    autoConnect: true,
    auth: (cb) => {
      tokenStorage.getAccess().then((token) => cb({ token }));
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
