import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCompanyJob } from '@/lib/company-jobs';
import { getTechTest } from '@/lib/tech-tests';
import { getDataComparison } from '@/lib/compare';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { CandidateCompareGrid } from '@/components/candidate-compare-grid';
import { AiComparisonPanel } from '@/components/ai-comparison-panel';

export const metadata: Metadata = { title: 'Comparar candidatos · Nab' };

export default async function CompareCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { id: jobId } = await params;
  const { ids } = await searchParams;
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');
  const companyId = user.recruiterCompany.id;

  const applicationIds = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (applicationIds.length < 2 || applicationIds.length > 4) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-danger">Selecciona entre 2 y 4 candidatos desde la tabla para comparar.</p>
        <Link href={`/empresa/vacantes/${jobId}/candidatos`} className="text-sm text-primary hover:underline">
          ← Volver a candidatos
        </Link>
      </div>
    );
  }

  let job;
  try {
    job = await getCompanyJob(companyId, jobId, access);
  } catch {
    notFound();
  }
  if (!job.techTestId) notFound();

  const [techTest, comparison] = await Promise.all([
    getTechTest(companyId, job.techTestId, access),
    getDataComparison(companyId, jobId, applicationIds, access),
  ]);
  const criteria = techTest.rubricJson?.criteria ?? [];

  const candidateNames = Object.fromEntries(comparison.candidates.map((c) => [c.id, c.user.name]));
  const criteriaNames = Object.fromEntries(criteria.map((c) => [c.id, c.name]));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/empresa/vacantes/${jobId}/candidatos`} className="text-sm text-muted hover:text-foreground">
          ← Candidatos de {job.title}
        </Link>
        <h1 className="font-display text-2xl text-foreground">Comparar candidatos</h1>
      </div>

      <CandidateCompareGrid criteria={criteria} candidates={comparison.candidates} />

      <div>
        <h2 className="mb-3 font-display text-lg text-foreground">Análisis con IA</h2>
        <AiComparisonPanel
          companyId={companyId}
          jobId={jobId}
          applicationIds={applicationIds}
          candidateNames={candidateNames}
          criteriaNames={criteriaNames}
        />
      </div>
    </div>
  );
}
