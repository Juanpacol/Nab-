import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/session';

/**
 * Proxy de streaming del chat (Fase 5). El token vive en una cookie httpOnly
 * (no accesible desde el navegador), así que este route handler lo lee en el
 * servidor, reenvía a la API y canaliza el SSE de vuelta al cliente.
 */
export async function POST(req: Request): Promise<Response> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return new Response('Unauthorized', { status: 401 });

  const body = await req.text();
  const upstream = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Chat error', { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
