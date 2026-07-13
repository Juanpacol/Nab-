import * as Sentry from '@sentry/nextjs';

/**
 * Init del lado del navegador. Usa una clave NEXT_PUBLIC_* porque este
 * archivo se incluye en el bundle del cliente. Sin DSN, no-op.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
