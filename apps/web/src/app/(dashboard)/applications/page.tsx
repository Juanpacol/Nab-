import type { Metadata } from 'next';
import { Card } from '@nab/ui';
import { listApplications, getApplicationMetrics, type ApplicationCard, type Metrics } from '@/lib/applications';
import { KanbanBoard } from '@/components/kanban-board';

export const metadata: Metadata = { title: 'Aplicaciones' };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="font-display text-2xl text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </Card>
  );
}

export default async function ApplicationsPage() {
  let apps: ApplicationCard[] = [];
  let metrics: Metrics | null = null;
  let error: string | null = null;
  try {
    [apps, metrics] = await Promise.all([listApplications(), getApplicationMetrics()]);
  } catch {
    error = 'No se pudieron cargar tus aplicaciones. ¿Está la API arriba?';
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">Aplicaciones</h1>
      <p className="mt-1 text-muted">
        Arrastra cada tarjeta entre columnas (o usa el selector) para actualizar su estado.
      </p>

      {error ? (
        <Card className="mt-6 p-6 text-center text-sm text-danger">{error}</Card>
      ) : (
        <>
          {metrics && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={metrics.applied} />
              <Stat label="Esta semana" value={metrics.appliedThisWeek} />
              <Stat label="Tasa de respuesta" value={`${metrics.responseRate}%`} />
              <Stat label="Entrevistas" value={metrics.byStatus.INTERVIEW ?? 0} />
            </div>
          )}

          <div className="mt-8">
            <KanbanBoard initial={apps} />
          </div>
        </>
      )}
    </div>
  );
}
