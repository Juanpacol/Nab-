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
  let upstream: Response;
  try {
    // 60s: cubre el cold start de la API en la Ruta A (Render free tier, ~1
    // min dormido) sin cortar respuestas de chat normales, que son mucho más
    // cortas. Sin esto, un servidor dormido deja el fetch colgado sin límite.
    upstream = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return new Response('Chat error', { status: 503 });
  }

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
