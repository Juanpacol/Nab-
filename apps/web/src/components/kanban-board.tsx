'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@nab/ui';
import { APPLICATION_STATUS_LABELS, KANBAN_COLUMNS } from '@nab/shared';
import { updateStatusAction } from '@/app/actions/applications';
import type { ApplicationCard } from '@/lib/applications';

/**
 * Kanban de seguimiento (Fase 4). Arrastra tarjetas entre columnas (drag & drop
 * nativo en escritorio) o cambia el estado con el selector (móvil/accesible);
 * cada cambio persiste vía API y registra un evento en el timeline.
 */
export function KanbanBoard({ initial }: { initial: ApplicationCard[] }) {
  const [apps, setApps] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  function move(id: string, status: string) {
    const current = apps.find((a) => a.id === id);
    if (!current || current.status === status) return;
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    void updateStatusAction(id, status);
  }

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {KANBAN_COLUMNS.map((col) => {
        const items = apps.filter((a) => a.status === col);
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col);
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={() => {
              if (dragId) move(dragId, col);
              setDragId(null);
              setOverCol(null);
            }}
            className={`min-w-0 rounded-md p-1 transition-colors ${
              overCol === col ? 'bg-primary-soft/50' : ''
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-mono text-xs uppercase tracking-wide text-muted">
                {APPLICATION_STATUS_LABELS[col]}
              </h2>
              <span className="font-mono text-xs text-muted">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map((app) => (
                <Card
                  key={app.id}
                  draggable
                  onDragStart={() => setDragId(app.id)}
                  onDragEnd={() => setDragId(null)}
                  className="cursor-grab p-4 active:cursor-grabbing"
                >
                  <Link href={`/applications/${app.id}`} className="block">
                    <p className="truncate text-sm font-medium text-foreground hover:text-primary">
                      {app.job.title}
                    </p>
                    <p className="truncate text-xs text-muted">{app.job.company}</p>
                  </Link>
                  <select
                    value={app.status}
                    onChange={(e) => move(app.id, e.target.value)}
                    className="mt-2 w-full rounded-sm border border-border bg-bg px-1 py-0.5 text-xs text-muted"
                    aria-label="Cambiar estado"
                  >
                    {KANBAN_COLUMNS.map((s) => (
                      <option key={s} value={s}>
                        {APPLICATION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Card>
              ))}
              {items.length === 0 && (
                <div className="rounded-sm border border-dashed border-border py-8 text-center text-xs text-muted">
                  Vacío
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
