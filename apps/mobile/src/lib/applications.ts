import { apiFetch } from './api';
import type { JobCard } from './jobs';

export interface ApplicationCard {
  id: string;
  status: string;
  matchScore: number | null;
  submittedAt: string | null;
  updatedAt: string;
  job: Pick<JobCard, 'id' | 'title' | 'company' | 'companyLogoUrl' | 'location'> & { applyUrl: string };
}

export interface ApplyResult {
  application: { id: string };
  applyUrl: string;
  alreadyApplied: boolean;
}

/** Aplica a una vacante (asistido; descuenta 1 crédito). */
export async function applyToJob(jobId: string): Promise<ApplyResult> {
  return apiFetch<ApplyResult>('/applications', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  });
}

export async function listApplications(): Promise<ApplicationCard[]> {
  return apiFetch<ApplicationCard[]>('/applications');
}

export async function updateApplicationStatus(id: string, status: string): Promise<void> {
  await apiFetch(`/applications/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
