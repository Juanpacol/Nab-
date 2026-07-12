import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, StatusPill } from '@nab/ui';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Inicio' };

const RECENT = [
  { role: 'Ingeniero Full Stack', company: 'Stripe', status: 'INTERVIEW' },
  { role: 'Frontend Engineer', company: 'Figma', status: 'APPLIED' },
  { role: 'Data Analyst', company: 'Netflix', status: 'VIEWED' },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const firstName = user?.name?.split(' ')[0] ?? 'de nuevo';

  const metrics = [
    { label: 'Aplicaciones esta semana', value: '0' },
    { label: 'Tasa de respuesta', value: '—' },
    { label: 'Entrevistas activas', value: '0' },
    { label: 'Créditos restantes', value: String(user?.creditsRemaining ?? 0) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Hola, {firstName} 👋</h1>
          <p className="mt-1 text-muted">
            {user?.onboarded
              ? 'Esto es lo que pasó con tu búsqueda.'
              : 'Completa tu perfil para empezar a recibir vacantes con match.'}
          </p>
        </div>
        <Link href={user?.onboarded ? '/feed' : '/onboarding'}>
          <Button>{user?.onboarded ? 'Descubrir vacantes' : 'Completar perfil'}</Button>
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
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
