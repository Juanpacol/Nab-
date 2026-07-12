import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, StatusPill } from '@nab/ui';

export const metadata: Metadata = { title: 'Inicio' };

const METRICS = [
  { label: 'Aplicaciones esta semana', value: '14' },
  { label: 'Tasa de respuesta', value: '38%' },
  { label: 'Entrevistas activas', value: '3' },
  { label: 'Créditos restantes', value: '200' },
];

const RECENT = [
  { role: 'Ingeniero Full Stack', company: 'Stripe', status: 'INTERVIEW' },
  { role: 'Frontend Engineer', company: 'Figma', status: 'APPLIED' },
  { role: 'Data Analyst', company: 'Netflix', status: 'VIEWED' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Hola, Demo 👋</h1>
          <p className="mt-1 text-muted">Esto es lo que pasó con tu búsqueda.</p>
        </div>
        <Link href="/feed">
          <Button>Descubrir vacantes</Button>
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRICS.map((m) => (
          <Card key={m.label} className="p-5">
            <p className="font-mono text-3xl text-foreground">{m.value}</p>
            <p className="mt-1 text-sm text-muted">{m.label}</p>
          </Card>
        ))}
      </div>

      {/* Actividad reciente */}
      <Card className="p-6">
        <h2 className="font-display text-xl text-foreground">Actividad reciente</h2>
        <ul className="mt-4 divide-y divide-border">
          {RECENT.map((r) => (
            <li key={r.role} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-foreground">{r.role}</p>
                <p className="text-sm text-muted">{r.company}</p>
              </div>
              <StatusPill status={r.status} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
