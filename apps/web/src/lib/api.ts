/**
 * Cliente HTTP hacia la API de Nab. Usado desde el servidor (server actions,
 * server components) con la URL interna de la API.
 */
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiError {
  statusCode: number;
  error: unknown;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = options;
  // 45s: en la Ruta A (Render free tier) la API puede estar dormida y tardar
  // hasta ~1 min en despertar. Sin timeout, un proveedor caído o un cold
  // start colgado deja el request esperando indefinidamente.
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    const apiErr: ApiError = {
      statusCode: 503,
      error: timedOut
        ? 'El servidor tardó demasiado en responder (puede estar despertando)'
        : 'No se pudo conectar con el servidor',
    };
    throw apiErr;
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const err: ApiError = { statusCode: res.status, error: body };
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { API_URL };
