import { NextResponse } from 'next/server';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken, getCurrentUser } from '@/lib/session';

/**
 * Proxy de solo lectura para que el wizard de creación de prueba (cliente)
 * pueda hacer polling del estado de generación sin exponer el access token
 * — mismo patrón que /api/realtime-token: el servidor de Next.js es el
 * único que lee la cookie httpOnly y resuelve companyId de la sesión, nunca
 * el cliente. Es el fallback si el socket de tiempo real se desconecta.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [access, user] = await Promise.all([getAccessToken(), getCurrentUser()]);
  if (!access || !user?.recruiterCompany) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const test = await apiFetch(`/companies/${user.recruiterCompany.id}/tests/${id}`, { accessToken: access });
    return NextResponse.json(test);
  } catch (err) {
    const apiErr = err as ApiError;
    return NextResponse.json({ error: 'No se pudo obtener la prueba' }, { status: apiErr.statusCode ?? 500 });
  }
}
