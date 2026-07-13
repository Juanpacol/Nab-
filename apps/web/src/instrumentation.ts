import * as Sentry from '@sentry/nextjs';

/**
 * Hook de arranque de Next.js (server + edge runtime). Sin SENTRY_DSN el SDK
 * queda inactivo (no-op), así que es seguro tenerlo siempre activo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
