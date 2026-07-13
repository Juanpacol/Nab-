'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Captura errores de renderizado de React que escapan a cualquier error
 * boundary local (reemplaza el layout raíz mientras se muestra, por eso
 * incluye sus propias etiquetas html/body).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1>Algo salió mal</h1>
          <p>Ya lo registramos. Intenta recargar la página.</p>
        </div>
      </body>
    </html>
  );
}
