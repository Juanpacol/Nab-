import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Button, Card, CardContent, Stat } from '@nab/ui';
import { getCompanyJob } from '@/lib/company-jobs';
import { getApplicantsTrend, getJobMetrics, getScoreDistribution } from '@/lib/company-dashboard';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { ApplicantsTrend } from '@/components/charts/applicants-trend';
import { FunnelChart } from '@/components/charts/funnel-chart';
import { PassRateRing } from '@/components/charts/pass-rate-ring';
import { ScoreDistribution } from '@/components/charts/score-distribution';
import { CloseJobButton } from './close-job-button';

export const metadata: Metadata = { title: 'Detalle de vacante · Nab' };

function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => n.toLocaleString('es-MX');
  if (min != null && max != null) return `${currency ?? 'USD'} ${fmt(min)} – ${fmt(max)}`;
  return `${currency ?? 'USD'} ${fmt((min ?? max)!)}`;
}

export default async function CompanyJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');

  let job;
  try {
    job = await getCompanyJob(user.recruiterCompany.id, id, access);
  } catch {
    notFound();
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);
  const [metrics, trend, distribution] = await Promise.all([
    getJobMetrics(user.recruiterCompany.id, id, access),
    getApplicantsTrend(user.recruiterCompany.id, id, access),
    getScoreDistribution(user.recruiterCompany.id, id, access),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={job.isActive ? 'success' : 'neutral'}>{job.isActive ? 'Activa' : 'Cerrada'}</Badge>
            {job.remote && <Badge variant="info">Remoto</Badge>}
            {job.techTestId && <Badge variant="primary">🧪 Incluye prueba técnica</Badge>}
          </div>
          <h1 className="font-display text-2xl text-foreground">{job.title}</h1>
          {job.location && <p className="text-sm text-muted">{job.location}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/empresa/vacantes/${job.id}/candidatos`}>
            <Button variant="outline">Candidatos</Button>
          </Link>
          <Link href={`/empresa/vacantes/${job.id}/prueba`}>
            <Button variant="outline">{job.techTestId ? 'Prueba técnica' : 'Crear prueba con IA'}</Button>
          </Link>
          <Link href={`/empresa/vacantes/${job.id}/editar`}>
            <Button variant="outline">Editar</Button>
          </Link>
          <CloseJobButton companyId={user.recruiterCompany.id} jobId={job.id} isActive={job.isActive} />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-6 text-sm">
            {salary && (
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-muted">Salario</p>
                <p className="text-foreground">{salary}</p>
              </div>
            )}
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted">Aplicantes</p>
              <p className="text-foreground">{job._count.applications}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Descripción</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{job.description}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-display text-lg text-foreground">Dashboard</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex gap-6">
                <Stat label="Aplicantes" value={metrics.totalApplicants} />
                <Stat label="Evaluados" value={metrics.evaluatedCount} />
              </div>
              <FunnelChart byStatus={metrics.byStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="mb-2 font-mono text-xs uppercase tracking-wide text-muted">Pass rate de la prueba</p>
              <PassRateRing evaluatedCount={metrics.evaluatedCount} passRate={metrics.passRate} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="mb-2 font-mono text-xs uppercase tracking-wide text-muted">Aplicantes (últimos 30 días)</p>
              <ApplicantsTrend points={trend.points} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="mb-2 font-mono text-xs uppercase tracking-wide text-muted">Distribución de scores IA</p>
              <ScoreDistribution bins={distribution.bins} passScore={distribution.passScore} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
