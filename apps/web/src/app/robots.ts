import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nab.app';

/** robots.txt (Fase 6, SEO): permite indexar lo público, bloquea el panel privado. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/feed',
        '/applications',
        '/jobs',
        '/coach',
        '/profile',
        '/settings',
        '/billing',
        '/onboarding',
        '/api/',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
