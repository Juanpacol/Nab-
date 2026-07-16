import { create } from 'zustand';

interface UnreadState {
  /** Total de mensajes de chat sin leer (candidato: de RH; empresa: de candidatos). */
  count: number;
  /** Hilo actualmente abierto en pantalla — un mensaje nuevo de este hilo no incrementa el badge. */
  activeThreadId: string | null;
  setCount: (count: number) => void;
  increment: () => void;
  setActiveThread: (threadId: string | null) => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  count: 0,
  activeThreadId: null,
  setCount: (count) => set({ count: Math.max(0, count) }),
  increment: () => set((s) => ({ count: s.count + 1 })),
  setActiveThread: (threadId) => set({ activeThreadId: threadId }),
}));
