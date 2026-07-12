'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/** Alterna el tema claro/oscuro escribiendo data-theme en <html> y persistiéndolo. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = (localStorage.getItem('nab-theme') as Theme | null) ?? null;
    const initial =
      stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nab-theme', next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Cambiar tema"
      className="flex h-9 w-9 items-center justify-center rounded-sm border border-border text-foreground transition-colors hover:bg-surface-2"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
