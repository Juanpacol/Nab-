'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@nab/ui';

/**
 * Red de seguridad para cualquier ruta bajo (dashboard) que no maneje sus
 * propios errores de `apiFetch` (ej. la API dormida en la Ruta A tardando
 * más de lo que tolera el timeout). Sin esto, un throw sin capturar dejaba
 * ver la pantalla de error genérica de Next sin opción de reintentar.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <h2 className="text-lg font-semibold">No pudimos cargar esto</h2>
        <p className="mt-1 text-sm text-foreground/60">
          El servidor puede estar despertando (puede tardar hasta un minuto). Intenta de nuevo.
        </p>
      </div>
      <Button onClick={() => reset()}>Reintentar</Button>
    </div>
  );
}
