import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nab.app';

/** Sitemap de las páginas públicas (Fase 6, SEO). Las rutas del panel son privadas. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/login', '/register', '/legal/privacy', '/legal/terms', '/legal/refund'];
  return routes.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'yearly',
    priority: path === '' ? 1 : 0.4,
  }));
}
