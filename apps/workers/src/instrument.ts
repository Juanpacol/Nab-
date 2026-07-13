import * as Sentry from '@sentry/node';

/**
 * Debe importarse ANTES que cualquier otro módulo en main.ts (misma razón que
 * en apps/api). Sin SENTRY_DSN el SDK queda inactivo (no-op).
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
