import * as Sentry from '@sentry/node';

/**
 * Debe importarse ANTES que cualquier otro módulo en main.ts: la
 * instrumentación automática de Sentry (HTTP, Postgres, etc.) solo funciona
 * si se inicializa antes de que esos módulos se carguen. Sin SENTRY_DSN el
 * SDK queda inactivo (no-op), así que es seguro tenerlo siempre importado.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
