import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

/**
 * Proxy de subida de CV: recibe el multipart del navegador y lo reenvía a la
 * API con el access token de la cookie httpOnly (que el cliente no puede leer).
 */
export async function POST(req: NextRequest) {
  const access = await getAccessToken();
  if (!access) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData();
  const res = await fetch(`${API_URL}/api/users/me/resume/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}` },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
