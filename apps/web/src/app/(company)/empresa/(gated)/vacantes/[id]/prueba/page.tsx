import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Button, Card, CardContent, EmptyState } from '@nab/ui';
import { getCompanyJob } from '@/lib/company-jobs';
import { getTechTest } from '@/lib/tech-tests';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { DetachTestButton } from './detach-test-button';
import { RetryGenerationButton } from './retry-generation-button';

export const metadata: Metadata = { title: 'Prueba técnica · Nab' };

const STATUS_LABEL: Record<string, string> = {
  GENERATING: 'Generando…',
  READY: 'Lista',
  FAILED: 'Falló la generación',
  ARCHIVED: 'Archivada',
};

export default async function JobTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');
  const companyId = user.recruiterCompany.id;

  let job;
  try {
    job = await getCompanyJob(companyId, jobId, access);
  } catch {
    notFound();
  }

  if (!job.techTestId) {
    return (
      <div className="max-w-xl">
        <EmptyState
          icon={<span className="text-3xl">🧪</span>}
          title="Esta vacante no tiene una prueba técnica"
          description="Genera una con IA a partir del título y la descripción del puesto — incluye una rúbrica con referencias citadas."
          action={
            <Link href={`/empresa/vacantes/${jobId}/prueba/crear`}>
              <Button>Crear prueba con IA</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const test = await getTechTest(companyId, job.techTestId, access);
  const questionCount = test.questionsJson?.length ?? 0;
  const criteriaCount = test.rubricJson?.criteria.length ?? 0;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Prueba técnica</h1>
        <p className="text-sm text-muted">{job.title}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{test.title}</p>
              <p className="text-sm text-muted">Versión {test.version}</p>
            </div>
            <Badge
              variant={
                test.status === 'READY' ? 'success' : test.status === 'FAILED' ? 'danger' : 'neutral'
              }
            >
              {STATUS_LABEL[test.status] ?? test.status}
            </Badge>
          </div>

          {test.status === 'GENERATING' && (
            <p className="text-sm text-muted">
              La IA está generando la prueba. Esto puede tardar hasta un minuto — refresca la página en un momento.
            </p>
          )}

          {test.status === 'FAILED' && (
            <div className="space-y-3">
              <p className="text-sm text-danger">{test.generationError ?? 'La generación falló.'}</p>
              <RetryGenerationButton testId={test.id} />
            </div>
          )}

          {test.status === 'READY' && (
            <>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wide text-muted">Preguntas</p>
                  <p className="text-foreground">{questionCount}</p>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wide text-muted">Criterios</p>
                  <p className="text-foreground">{criteriaCount}</p>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wide text-muted">Tiempo límite</p>
                  <p className="text-foreground">{test.timeLimitMinutes ?? '—'} min</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/empresa/vacantes/${jobId}/prueba/crear?edit=${test.id}`}>
                  <Button variant="outline">Editar</Button>
                </Link>
                <DetachTestButton jobId={jobId} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
