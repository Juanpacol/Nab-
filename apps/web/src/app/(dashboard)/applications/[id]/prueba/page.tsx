import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getApplication } from '@/lib/applications';
import { getApplicationTest } from '@/lib/test-taking';
import { TestRunner } from './test-runner';

export const metadata: Metadata = { title: 'Prueba técnica · Nab' };

export default async function TakeTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params;

  let app;
  try {
    app = await getApplication(applicationId);
  } catch {
    notFound();
  }
  if (!app.job.techTestId) redirect(`/applications/${applicationId}`);

  let test;
  try {
    test = await getApplicationTest(applicationId);
  } catch {
    notFound();
  }

  // Ya se envió (o está en evaluación) — no hay nada que tomar, vuelve al detalle.
  if (test.submission && test.submission.status !== 'IN_PROGRESS') {
    redirect(`/applications/${applicationId}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <TestRunner applicationId={applicationId} test={test} />
    </div>
  );
}
