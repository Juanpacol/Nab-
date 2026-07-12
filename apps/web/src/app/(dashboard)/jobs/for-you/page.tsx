import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, Card } from '@nab/ui';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { formatSalary, type JobCard } from '@/lib/jobs';
import { SaveJobButton } from '@/components/save-job-button';

export const metadata: Metadata = { title: 'Para ti' };

/**
 * Feed "Para ti" (Fase 3): vacantes recomendadas por matching semántico
 * perfil↔vacante, con el porcentaje de match en cada card.
 */
export default async function ForYouPage() {
  const access = await getAccessToken();
  let data: JobCard[] = [];
  let error: string | null = null;
  try {
    const res = await apiFetch<{ data: JobCard[] }>('/jobs/for-you', {
      accessToken: access ?? undefined,
    });
    data = res.data;
  } catch {
    error = 'No se pudieron cargar tus recomendaciones.';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Para ti</h1>
          <p className="mt-1 text-muted">Vacantes que encajan con tu perfil, ordenadas por match.</p>
        </div>
        <Link href="/jobs" className="text-sm text-primary hover:underline">
          Explorar todo →
        </Link>
      </div>

      {error ? (
        <Card className="p-6 text-center text-sm text-danger">{error}</Card>
      ) : data.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-4xl">🎯</p>
          <p className="mt-3 font-display text-xl text-foreground">Aún no hay recomendaciones</p>
          <p className="mt-1 text-sm text-muted">
            Completa tu perfil (headline, skills, roles deseados) para activar el matching.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.map((job) => {
            const salary = formatSalary(job);
            return (
              <li key={job.id}>
                <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-primary-soft font-display text-lg text-primary">
                        {job.company.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{job.title}</p>
                        <p className="truncate text-sm text-muted">
                          {job.company}
                          {job.location ? ` · ${job.location}` : ''}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    {typeof job.score === 'number' && (
                      <Badge variant={job.score >= 0.75 ? 'primary' : undefined}>
                        {Math.round(job.score * 100)}% match
                      </Badge>
                    )}
                    {salary && <span className="font-mono text-sm text-foreground">{salary}</span>}
                    <SaveJobButton jobId={job.id} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
