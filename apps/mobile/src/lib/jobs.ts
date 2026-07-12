import { apiFetch } from './api';

export interface JobCard {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  postedAt: string | null;
  score?: number;
}

export interface JobSearchResult {
  data: JobCard[];
  nextCursor: string | null;
}

/** Feed "Para ti": matching semántico perfil↔vacante. */
export async function fetchForYou(): Promise<JobCard[]> {
  const res = await apiFetch<JobSearchResult>('/jobs/for-you');
  return res.data;
}

/** Catálogo reciente (fallback si aún no hay match por perfil incompleto). */
export async function fetchRecentJobs(limit = 20): Promise<JobCard[]> {
  const res = await apiFetch<JobSearchResult>(`/jobs?limit=${limit}`);
  return res.data;
}

export async function saveJob(jobId: string): Promise<void> {
  await apiFetch(`/jobs/${jobId}/save`, { method: 'POST' });
}

export function formatSalary(job: Pick<JobCard, 'salaryMin' | 'salaryMax' | 'currency'>): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  const cur = job.currency ?? 'USD';
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)} ${cur}`;
  return `${fmt((job.salaryMin ?? job.salaryMax)!)} ${cur}`;
}
