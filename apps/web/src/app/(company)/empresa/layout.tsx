import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';

/**
 * Layout raíz de /empresa/*: solo exige sesión. La comprobación de "¿el
 * usuario ya tiene una empresa?" vive en `(gated)/layout.tsx`, un nivel más
 * abajo — así /empresa/onboarding (donde un usuario SIN empresa todavía crea
 * la suya) no queda atrapado detrás de ese segundo gate.
 */
export default async function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return children;
}
