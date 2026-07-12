import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, Card } from '@nab/ui';
import { searchJobs, formatSalary, type JobCard } from '@/lib/jobs';
import { FiltersBar } from './filters-bar';
import { SaveJobButton } from '@/components/save-job-button';

export const metadata: Metadata = { title: 'Explorar vacantes' };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  let result: { data: JobCard[]; nextCursor: string | null } = { data: [], nextCursor: null };
  let error: string | null = null;
  try {
    result = await searchJobs({
      query: sp.query,
      location: sp.location,
      remote: sp.remote === 'true' ? true : undefined,
      semantic: sp.semantic === 'true',
      limit: 20,
    });
  } catch {
    error = 'No se pudieron cargar las vacantes. ¿Está la API arriba?';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-foreground">Explorar vacantes</h1>
        <p className="mt-1 text-muted">Filtra por puesto, ubicación o busca con IA.</p>
      </div>

      <FiltersBar />

      {error ? (
        <Card className="p-6 text-center text-sm text-danger">{error}</Card>
      ) : result.data.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 font-display text-xl text-foreground">Sin resultados</p>
          <p className="mt-1 text-sm text-muted">Ajusta los filtros o sincroniza el catálogo.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {result.data.map((job) => {
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
                    {job.remote && <Badge variant="primary">Remoto</Badge>}
                    {typeof job.score === 'number' && (
                      <span className="font-mono text-xs text-success">
                        {Math.round(job.score * 100)}%
                      </span>
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
