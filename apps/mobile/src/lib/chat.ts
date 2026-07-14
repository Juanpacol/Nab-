import { fetch as expoFetch } from 'expo/fetch';
import { API_URL } from './api';
import { tokenStorage } from './storage';

export interface ChatEvent {
  typing?: boolean;
  delta?: string;
  done?: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * Envía un mensaje al chat (soporte/coach) y consume la respuesta en
 * streaming (SSE) usando `expo/fetch`, que sí soporta leer el `body` como
 * stream en iOS/Android (a diferencia del `fetch` global de React Native).
 */
export async function streamChat(
  contextType: 'SUPPORT' | 'CAREER_COACH',
  content: string,
  sessionId: string | undefined,
  onEvent: (evt: ChatEvent) => void,
): Promise<void> {
  const token = await tokenStorage.getAccess();
  // 60s: cubre el cold start de la API en Render free tier sin cortar
  // respuestas de chat normales (más cortas). El caller ya envuelve esta
  // función en try/catch, así que dejamos que el abort se propague como error.
  const res = await expoFetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ contextType, content, sessionId }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok || !res.body) throw new Error('No se pudo conectar con el chat');

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
      try {
        onEvent(JSON.parse(line.slice(6)) as ChatEvent);
      } catch {
        // línea SSE incompleta/corrupta — se ignora
      }
    }
  }
}
