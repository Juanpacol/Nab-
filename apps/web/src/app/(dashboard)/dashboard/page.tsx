import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, StatusPill } from '@nab/ui';
import { getCurrentUser, getAccessToken } from '@/lib/session';
import { apiFetch } from '@/lib/api';

export const metadata: Metadata = { title: 'Inicio' };

interface ApplicationMetrics {
  byStatus: Record<string, number>;
  appliedThisWeek: number;
  responseRate: number;
}

interface RecentApplication {
  id: string;
  status: string;
  autoApplied: boolean;
  job: { title: string; company: string };
}

export default async function DashboardPage() {
  const [user, access] = await Promise.all([getCurrentUser(), getAccessToken()]);
  const firstName = user?.name?.split(' ')[0] ?? 'de nuevo';

  // Datos reales del usuario en vez de placeholders — con `allSettled` para
  // que un fallo parcial (API dormida en cold start) no tumbe todo el panel.
  const [metricsResult, recentResult] = await Promise.allSettled([
    apiFetch<ApplicationMetrics>('/applications/metrics', { accessToken: access ?? undefined }),
    apiFetch<RecentApplication[]>('/applications', { accessToken: access ?? undefined }),
  ]);

  const appMetrics = metricsResult.status === 'fulfilled' ? metricsResult.value : null;
  const recent = recentResult.status === 'fulfilled' ? recentResult.value.slice(0, 3) : [];
  const loadFailed = metricsResult.status === 'rejected' && recentResult.status === 'rejected';

  const metrics = [
    { label: 'Aplicaciones esta semana', value: appMetrics ? String(appMetrics.appliedThisWeek) : '—' },
    { label: 'Tasa de respuesta', value: appMetrics ? `${appMetrics.responseRate}%` : '—' },
    { label: 'Entrevistas activas', value: appMetrics ? String(appMetrics.byStatus.INTERVIEW ?? 0) : '—' },
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
        {loadFailed ? (
          <p className="mt-4 text-sm text-muted">
            No pudimos cargar tu actividad ahora mismo. Intenta recargar la página en un momento.
          </p>
        ) : recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Todavía no has aplicado a ninguna vacante.{' '}
            <Link href="/feed" className="text-primary underline">
              Descubre vacantes
            </Link>{' '}
            para empezar.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-foreground">
                    {r.job.title}
                    {r.autoApplied && (
                      <span
                        className="ml-2 rounded-sm bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary"
                        title="Aplicada automáticamente por el agente"
                      >
                        🤖 Auto
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted">{r.job.company}</p>
                </div>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
