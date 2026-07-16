import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Badge,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nab/ui';
import { listCompanyJobs } from '@/lib/company-jobs';
import { getAccessToken, getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Vacantes · Nab' };

export default async function CompanyJobsPage() {
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');

  const jobs = await listCompanyJobs(user.recruiterCompany.id, access);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-foreground">Vacantes</h1>
          <p className="text-sm text-muted">Publica y da seguimiento a tus vacantes propias.</p>
        </div>
        <Link href="/empresa/vacantes/nueva">
          <Button>Publicar vacante</Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<span className="text-3xl">📢</span>}
          title="Todavía no tienes vacantes"
          description="Publica tu primera vacante para que los candidatos de Nab la vean en su feed."
          action={
            <Link href="/empresa/vacantes/nueva">
              <Button>Publicar vacante</Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vacante</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Aplicantes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Link href={`/empresa/vacantes/${job.id}`} className="font-medium text-foreground hover:text-primary">
                    {job.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted">
                  {job.remote ? 'Remoto' : (job.location ?? '—')}
                </TableCell>
                <TableCell>
                  <Badge variant={job.isActive ? 'success' : 'neutral'}>
                    {job.isActive ? 'Activa' : 'Cerrada'}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{job._count.applications}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
