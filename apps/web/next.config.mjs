import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necesario para el build de Docker (standalone reduce el tamaño de la imagen).
  output: 'standalone',
  // Transpila los paquetes del monorepo consumidos como código fuente.
  transpilePackages: ['@nab/ui', '@nab/shared'],
  eslint: {
    // El lint se corre como paso separado en CI.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Los paquetes del monorepo usan resolución NodeNext (imports con .js).
    // Esto permite a webpack resolver './plans.js' → './plans.ts'.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

// Sin SENTRY_AUTH_TOKEN (p.ej. en dev o en un fork sin cuenta de Sentry) esto
// deshabilita solo la subida de source maps, no rompe el build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: false,
  webpack: { treeshake: { removeDebugLogging: true } },
});
