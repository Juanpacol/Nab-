import 'server-only';
import { cookies } from 'next/headers';

export const MODE_COOKIE = 'nab_mode';
export type NabMode = 'candidate' | 'company';

/**
 * No-httpOnly a propósito: no guarda ningún secreto, solo la preferencia de
 * modo (candidato/empresa) para decidir a dónde aterriza el login — tanto
 * middleware como componentes cliente pueden leerla sin decodificar nada.
 */
export async function getNabMode(): Promise<NabMode> {
  const store = await cookies();
  return store.get(MODE_COOKIE)?.value === 'company' ? 'company' : 'candidate';
}

export async function setNabMode(mode: NabMode): Promise<void> {
  const store = await cookies();
  store.set(MODE_COOKIE, mode, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
