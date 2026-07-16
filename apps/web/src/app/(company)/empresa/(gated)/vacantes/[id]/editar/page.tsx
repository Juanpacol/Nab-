import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCompanyJob } from '@/lib/company-jobs';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { CompanyJobForm } from '../../company-job-form';

export const metadata: Metadata = { title: 'Editar vacante · Nab' };

export default async function EditCompanyJobPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Editar vacante</h1>
        <p className="text-sm text-muted">{job.title}</p>
      </div>
      <CompanyJobForm mode="edit" companyId={user.recruiterCompany.id} job={job} />
    </div>
  );
}
