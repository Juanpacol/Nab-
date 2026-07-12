import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Nab — Deja de aplicar. Empieza a conseguir entrevistas.',
    template: '%s · Nab',
  },
  description:
    'Nab automatiza tu búsqueda de empleo: encuentra vacantes, genera CVs y cartas personalizados con IA, y aplica con un toque.',
  metadataBase: new URL('https://nab.app'),
  openGraph: {
    title: 'Nab',
    description: 'Tu búsqueda de empleo, automatizada con IA.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1512' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
