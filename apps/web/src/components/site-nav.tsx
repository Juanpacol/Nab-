import Link from 'next/link';
import { Button } from '@nab/ui';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

const LINKS = [
  { href: '#features', label: 'Funciones' },
  { href: '#comparison', label: 'Por qué Nab' },
  { href: '#pricing', label: 'Precios' },
  { href: '#faq', label: 'Preguntas' },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/">
          <Logo />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Empezar gratis</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
