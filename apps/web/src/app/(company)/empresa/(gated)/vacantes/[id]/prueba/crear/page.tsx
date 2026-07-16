import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCompanyJob } from '@/lib/company-jobs';
import { getTechTest } from '@/lib/tech-tests';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { TestWizard } from './test-wizard';

export const metadata: Metadata = { title: 'Crear prueba técnica · Nab' };

export default async function CreateTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id: jobId } = await params;
  const { edit: editTestId } = await searchParams;
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

  let initialTest = null;
  if (editTestId) {
    try {
      initialTest = await getTechTest(companyId, editTestId, access);
    } catch {
      // El id de la query no es válido: el wizard simplemente arranca desde cero.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">
          {initialTest ? 'Editar prueba técnica' : 'Crear prueba técnica con IA'}
        </h1>
        <p className="text-sm text-muted">{job.title}</p>
      </div>
      <TestWizard
        jobId={jobId}
        defaultRoleTitle={job.title}
        defaultSpec={job.description}
        initialTest={initialTest}
      />
    </div>
  );
}
