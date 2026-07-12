import type { Metadata } from 'next';
import { Card } from '@nab/ui';
import { APPLICATION_STATUS_LABELS, KANBAN_COLUMNS } from '@nab/shared';

export const metadata: Metadata = { title: 'Aplicaciones' };

// Datos demo; en Fase 4 el drag & drop persiste el estado vía API.
const DEMO: Record<string, { role: string; company: string }[]> = {
  SAVED: [{ role: 'Backend Engineer', company: 'Plaid' }],
  APPLIED: [
    { role: 'Frontend Engineer', company: 'Figma' },
    { role: 'Data Analyst', company: 'Netflix' },
  ],
  INTERVIEW: [{ role: 'Ingeniero Full Stack', company: 'Stripe' }],
  OFFER: [],
  REJECTED: [{ role: 'ML Engineer', company: 'Notion' }],
};

export default function ApplicationsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">Aplicaciones</h1>
      <p className="mt-1 text-muted">Arrastra cada tarjeta entre columnas para actualizar su estado.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-5">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col} className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-wide text-muted">
                {APPLICATION_STATUS_LABELS[col]}
              </h2>
              <span className="font-mono text-xs text-muted">{DEMO[col]?.length ?? 0}</span>
            </div>
            <div className="space-y-3">
              {(DEMO[col] ?? []).map((app) => (
                <Card key={app.role} className="cursor-grab p-4">
                  <p className="text-sm font-medium text-foreground">{app.role}</p>
                  <p className="text-xs text-muted">{app.company}</p>
                </Card>
              ))}
              {(DEMO[col]?.length ?? 0) === 0 && (
                <div className="rounded-sm border border-dashed border-border py-8 text-center text-xs text-muted">
                  Vacío
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
