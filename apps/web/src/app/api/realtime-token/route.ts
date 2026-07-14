import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/session';

/**
 * Expone el access token (que vive en una cookie httpOnly, invisible para JS
 * del navegador a propósito) SOLO para que el cliente pueda autenticar el
 * handshake del WebSocket — mismo patrón que /api/chat y /api/resume: el
 * servidor de Next.js es el único que lee la cookie, nunca el cliente
 * directamente. El token ya es de vida corta (15 min, ver session.ts), el
 * mismo nivel de exposición que ya acepta la app móvil al guardarlo en
 * SecureStore (legible por su JS).
 */
export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  return NextResponse.json({ token });
}
