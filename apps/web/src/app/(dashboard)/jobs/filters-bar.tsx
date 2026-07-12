'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@nab/ui';

/** Barra de filtros: actualiza los query params de la URL (búsqueda server-side). */
export function FiltersBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('query') ?? '');
  const [location, setLocation] = useState(params.get('location') ?? '');
  const [remote, setRemote] = useState(params.get('remote') === 'true');
  const [semantic, setSemantic] = useState(params.get('semantic') === 'true');

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query) p.set('query', query);
    if (location) p.set('location', location);
    if (remote) p.set('remote', 'true');
    if (semantic) p.set('semantic', 'true');
    router.push(`/jobs?${p.toString()}`);
  }

  return (
    <form onSubmit={apply} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Puesto, empresa o palabra clave"
          className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ubicación (ej. Remoto, Bogotá)"
          className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
          Solo remoto
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={semantic}
            onChange={(e) => setSemantic(e.target.checked)}
          />
          Búsqueda inteligente (IA)
        </label>
        <Button type="submit" size="sm" className="ml-auto">
          Buscar
        </Button>
      </div>
    </form>
  );
}
