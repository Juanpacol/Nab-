'use client';

import { useEffect, useState } from 'react';
import { Button } from '@nab/ui';

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
    <Button onClick={toggle} aria-label="Cambiar tema" variant="outline" size="icon" className="rounded-sm">
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  );
}
