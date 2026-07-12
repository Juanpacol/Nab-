import Link from 'next/link';
import { Logo } from './logo';

const COLUMNS = [
  {
    title: 'Producto',
    links: [
      { href: '#features', label: 'Funciones' },
      { href: '#pricing', label: 'Precios' },
      { href: '/mobile', label: 'App móvil' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/help', label: 'Centro de ayuda' },
      { href: '/affiliate', label: 'Programa de afiliados' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacidad' },
      { href: '/legal/terms', label: 'Términos' },
      { href: '/legal/refund', label: 'Reembolsos' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Tu búsqueda de empleo, automatizada con IA.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">{col.title}</p>
            <ul className="mt-4 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-foreground/80 hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 py-6 text-center font-mono text-xs text-muted">
        © {new Date().getFullYear()} Nab · Hecho para quienes buscan algo mejor.
      </div>
    </footer>
  );
}
