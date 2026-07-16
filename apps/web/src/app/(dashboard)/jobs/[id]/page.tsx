import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Badge, Button, Card } from '@nab/ui';
import { getJob, formatSalary } from '@/lib/jobs';
import { SaveJobButton } from '@/components/save-job-button';
import { GenerateDocsPanel } from '@/components/generate-docs-panel';
import { ApplyButton } from '@/components/apply-button';

export const metadata: Metadata = { title: 'Detalle de vacante' };

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let job;
  try {
    job = await getJob(id);
  } catch {
    notFound();
  }

  const salary = formatSalary(job);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/jobs" className="text-sm text-primary hover:underline">
        ← Volver a vacantes
      </Link>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm bg-primary-soft font-display text-2xl text-primary">
            {job.company.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl text-foreground">{job.title}</h1>
            <p className="mt-1 text-muted">
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {job.remote && <Badge variant="primary">Remoto</Badge>}
              {salary && <span className="font-mono text-sm text-foreground">{salary}</span>}
              {job.atsType && <Badge>{job.atsType}</Badge>}
              {job.techTestId && <Badge variant="primary">🧪 Incluye prueba técnica</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {job.applyUrl ? (
            <a href={job.applyUrl} target="_blank" rel="noreferrer">
              <Button>Aplicar en el sitio</Button>
            </a>
          ) : (
            <ApplyButton jobId={job.id} />
          )}
          <SaveJobButton jobId={job.id} size="md" />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg text-foreground">Descripción</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
          {job.description}
        </p>
      </Card>

      <GenerateDocsPanel jobId={job.id} jobTitle={job.title} />
    </div>
  );
}
