import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCompanyJob } from '@/lib/company-jobs';
import { listApplicants } from '@/lib/candidates';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { CandidatesTable } from '@/components/candidates-table';

export const metadata: Metadata = { title: 'Candidatos · Nab' };

export default async function CandidatesPage({ params }: { params: Promise<{ id: string }> }) {
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

  const applicants = await listApplicants(user.recruiterCompany.id, id, access);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href={`/empresa/vacantes/${id}`} className="text-sm text-muted hover:text-foreground">
          ← {job.title}
        </Link>
        <h1 className="font-display text-2xl text-foreground">Candidatos</h1>
      </div>
      <CandidatesTable companyId={user.recruiterCompany.id} jobId={id} applicants={applicants} />
    </div>
  );
}
